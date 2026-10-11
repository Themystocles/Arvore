const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const projectRoot = __dirname;
const dataPath = path.join(projectRoot, "assets", "people.json");
const localDataPath = path.join(projectRoot, "assets", "family.local.json");
const photosPath = path.join(projectRoot, "assets", "photos");
const port = Number(process.env.PORT || 4173);
const maximumUploadSize = 12 * 1024 * 1024;
const mimeTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp"
};
const imageExtensions = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp"
};

async function readRequestBody(request) {
    const chunks = [];
    let size = 0;

    for await (const chunk of request) {
        size += chunk.length;
        if (size > maximumUploadSize + 64 * 1024) throw new Error("A imagem pode ter no máximo 12 MB.");
        chunks.push(chunk);
    }

    return Buffer.concat(chunks);
}

function sendJson(response, status, data) {
    response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(JSON.stringify(data));
}

async function readFamilyData() {
    const family = JSON.parse(await fs.readFile(dataPath, "utf8"));
    let localData = { people: {} };

    try {
        localData = JSON.parse(await fs.readFile(localDataPath, "utf8"));
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }

    Object.entries(localData.people || {}).forEach(([id, person]) => {
        if (family.people[id]) family.people[id] = { ...family.people[id], ...person };
    });

    return { family, localData };
}

async function saveFamilyPerson(request, response, personId) {
    if (!/^[a-z0-9-]+$/.test(personId)) {
        sendJson(response, 400, { error: "Identificador inválido." });
        return;
    }

    const body = await readRequestBody(request);
    const formRequest = new Request(`http://localhost${request.url}`, {
        method: request.method,
        headers: request.headers,
        body,
        duplex: "half"
    });
    const form = await formRequest.formData();
    const { family, localData } = await readFamilyData();
    const person = family.people[personId];

    if (!person) {
        sendJson(response, 404, { error: "Pessoa não encontrada na árvore." });
        return;
    }

    person.name = String(form.get("name") || "").trim().slice(0, 100);
    person.description = String(form.get("description") || "").trim().slice(0, 500);

    const photo = form.get("photo");
    const removePhoto = form.get("removePhoto") === "1";
    if (photo && typeof photo.arrayBuffer === "function" && photo.size > 0) {
        if (photo.size > maximumUploadSize) {
            sendJson(response, 413, { error: "A imagem pode ter no máximo 12 MB." });
            return;
        }

        const extension = imageExtensions[photo.type];
        if (!extension) {
            sendJson(response, 415, { error: "Use uma imagem JPG, PNG ou WebP." });
            return;
        }

        await fs.mkdir(photosPath, { recursive: true });
        const filename = `${personId}${extension}`;
        const photoFilePath = path.join(photosPath, filename);
        await fs.writeFile(photoFilePath, Buffer.from(await photo.arrayBuffer()));

        if (person.photo && person.photo !== `/assets/photos/${filename}`) {
            const oldFilename = path.basename(person.photo);
            if (oldFilename === person.photo.slice("/assets/photos/".length)) {
                await fs.rm(path.join(photosPath, oldFilename), { force: true });
            }
        }
        person.photo = `/assets/photos/${filename}`;
    } else if (removePhoto && person.photo) {
        const oldFilename = path.basename(person.photo);
        if (oldFilename === person.photo.slice("/assets/photos/".length)) {
            await fs.rm(path.join(photosPath, oldFilename), { force: true });
        }
        person.photo = null;
    }

    localData.people ||= {};
    localData.people[personId] = {
        name: person.name,
        description: person.description,
        photo: person.photo
    };

    const temporaryPath = `${localDataPath}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(localData, null, 2)}\n`, "utf8");
    await fs.rename(temporaryPath, localDataPath);
    sendJson(response, 200, { person });
}

async function serveStaticFile(response, pathname) {
    const decodedPath = decodeURIComponent(pathname);
    const filePath = path.resolve(projectRoot, `.${decodedPath}`);
    if (filePath !== projectRoot && !filePath.startsWith(`${projectRoot}${path.sep}`)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
    }

    let resolvedPath = filePath;
    try {
        const stats = await fs.stat(resolvedPath);
        if (stats.isDirectory()) resolvedPath = path.join(resolvedPath, "index.html");
        const contents = await fs.readFile(resolvedPath);
        response.writeHead(200, {
            "Content-Type": mimeTypes[path.extname(resolvedPath).toLowerCase()] || "application/octet-stream",
            "Cache-Control": "no-cache"
        });
        response.end(contents);
    } catch {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Arquivo não encontrado.");
    }
}

const server = http.createServer(async (request, response) => {
    try {
        const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
        if (request.method === "GET" && url.pathname === "/api/family") {
            const { family } = await readFamilyData();
            sendJson(response, 200, family);
            return;
        }

        const personMatch = url.pathname.match(/^\/api\/people\/([a-z0-9-]+)$/);
        if (request.method === "PUT" && personMatch) {
            await saveFamilyPerson(request, response, personMatch[1]);
            return;
        }

        if (request.method !== "GET" && request.method !== "HEAD") {
            sendJson(response, 405, { error: "Método não permitido." });
            return;
        }

        await serveStaticFile(response, url.pathname === "/" ? "/index.html" : url.pathname);
    } catch (error) {
        sendJson(response, 500, { error: error.message || "Não foi possível salvar as alterações." });
    }
});

server.listen(port, "127.0.0.1", () => {
    console.log(`Árvore da família disponível em http://127.0.0.1:${port}`);
    console.log("As fotos e descrições serão gravadas localmente em assets/.");
});
