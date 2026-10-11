const treeRoot = document.querySelector("#family-tree");
const treeViewport = document.querySelector("#tree-viewport");
const editor = document.querySelector("#photo-lightbox");
const editorForm = editor.querySelector(".editor-form");
const pageStatus = document.querySelector("#photo-status");
const stepY = 84;
const cardWidth = 90;
const cardHeight = 78;
let family;
let canEdit = false;
let editingId = null;
let pendingPhoto = null;
let nodePositions = new Map();
let treeOrigin = { x: 0, y: 0 };

function centerSize() {
    return window.matchMedia("(max-width: 640px)").matches
        ? { width: 160, height: 172 }
        : { width: 184, height: 196 };
}

function horizontalStep() {
    return window.matchMedia("(max-width: 640px)").matches ? 104 : 148;
}

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function countLeaves(personId, counts = new Map()) {
    if (counts.has(personId)) return counts.get(personId);
    const person = family.people[personId];
    const count = person.parents?.length
        ? person.parents.reduce((total, parentId) => total + countLeaves(parentId, counts), 0)
        : 1;
    counts.set(personId, count);
    return count;
}

function placeAncestors(personId, direction, level, baseY, startLeaf, rootLeafCount, leafCounts) {
    const person = family.people[personId];
    const parents = person.parents || [];
    const x = direction * level * horizontalStep();
    let y;

    if (!parents.length) {
        y = baseY + (startLeaf - (rootLeafCount - 1) / 2) * stepY;
    } else {
        let nextLeaf = startLeaf;
        let weightedY = 0;
        let parentLeaves = 0;

        parents.forEach((parentId) => {
            const count = leafCounts.get(parentId);
            const parentPosition = placeAncestors(parentId, direction, level + 1, baseY, nextLeaf, rootLeafCount, leafCounts);
            weightedY += parentPosition.y * count;
            parentLeaves += count;
            nextLeaf += count;
        });
        y = weightedY / parentLeaves;
    }

    const side = personId.startsWith("pai") ? "paternal" : "maternal";
    const position = { x, y, side, parents };
    nodePositions.set(personId, position);
    return position;
}

function buildPositions() {
    nodePositions = new Map([["eliza", { x: 0, y: 0, side: "center", parents: family.child.parents }]]);
    const leafCounts = new Map();
    Object.keys(family.people).forEach((id) => countLeaves(id, leafCounts));

    [
        { id: "mae", direction: -1, y: stepY },
        { id: "pai", direction: 1, y: -stepY }
    ].forEach(({ id, direction, y }) => {
        const totalLeaves = leafCounts.get(id);
        placeAncestors(id, direction, 1, y, 0, totalLeaves, leafCounts);
    });
}

function makeAvatar(person, id, featured = false) {
    const button = element("button", `person-node${featured ? " person-node--featured" : ""}`);
    button.type = "button";
    button.dataset.personId = id;
    button.dataset.action = "edit";
    button.setAttribute("aria-label", `Editar ${person.role}${person.name ? `: ${person.name}` : ""}`);

    const portrait = element("span", `person-avatar${person.photo ? " person-avatar--photo" : " person-avatar--empty"}`);
    if (person.photo) {
        const image = element("img", "person-image");
        image.src = person.photo;
        image.alt = "";
        image.loading = "lazy";
        image.decoding = "async";
        portrait.append(image);
    } else {
        portrait.append(element("span", "avatar-add", "+"));
    }

    button.append(portrait, element("span", "person-role", person.role));
    return button;
}

function placeCard(card, x, y, width, height) {
    const left = treeOrigin.x + x - width / 2;
    const top = treeOrigin.y + y - height / 2;
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    return { left, right: left + width, top, bottom: top + height, x, y };
}

function renderConnectors(svg, dimensions) {
    const featured = centerSize();
    const parentsToDraw = [
        { childId: "eliza", parentIds: family.child.parents, side: "center" },
        ...Object.entries(family.people)
            .filter(([, person]) => person.parents?.length)
            .map(([childId, person]) => ({
                childId,
                parentIds: person.parents,
                side: childId.startsWith("mae") ? "maternal" : "paternal"
            }))
    ];

    parentsToDraw.forEach(({ childId, parentIds, side }) => {
        const child = nodePositions.get(childId);
        const parents = parentIds.map((id) => nodePositions.get(id)).filter(Boolean);
        if (!child || !parents.length) return;

        const averageParentX = parents.reduce((sum, parent) => sum + parent.x, 0) / parents.length;
        const averageParentY = parents.reduce((sum, parent) => sum + parent.y, 0) / parents.length;
        const parentDirections = parents.map((parent) => Math.sign(parent.x - child.x));
        const mixedDirections = new Set(parentDirections).size > 1;

        if (mixedDirections) {
            parents.forEach((parent) => {
                const dx = parent.x - child.x;
                const dy = parent.y - child.y;
                const horizontalFirst = Math.abs(dx) > Math.abs(dy);
                const startX = treeOrigin.x + child.x + (horizontalFirst ? Math.sign(dx) * featured.width / 2 : 0);
                const startY = treeOrigin.y + child.y + (horizontalFirst ? 0 : Math.sign(dy) * featured.height / 2);
                const endX = treeOrigin.x + parent.x - Math.sign(dx) * cardWidth / 2;
                const endY = treeOrigin.y + parent.y;
                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("class", `family-connector family-connector--${side}`);
                path.setAttribute("d", `M ${startX} ${startY} C ${startX + dx * 0.38} ${startY}, ${endX - dx * 0.38} ${endY}, ${endX} ${endY}`);
                svg.append(path);
            });
            return;
        }

        const direction = parentDirections[0] || (side === "paternal" ? -1 : 1);
        const childEdge = treeOrigin.x + child.x + direction * (childId === "eliza" ? featured.width / 2 : cardWidth / 2);
        const parentJoinX = treeOrigin.x + averageParentX - direction * cardWidth / 2;
        const childY = treeOrigin.y + child.y;
        const parentY = treeOrigin.y + averageParentY;
        const bendX = (childEdge + parentJoinX) / 2;
        const trunk = document.createElementNS("http://www.w3.org/2000/svg", "path");
        trunk.setAttribute("class", `family-connector family-connector--${side}`);
        trunk.setAttribute("d", `M ${childEdge} ${childY} H ${bendX} V ${parentY} H ${parentJoinX}`);
        svg.append(trunk);

        parents.forEach((parent) => {
            const parentX = treeOrigin.x + parent.x - direction * cardWidth / 2;
            const parentY = treeOrigin.y + parent.y;
            const branch = document.createElementNS("http://www.w3.org/2000/svg", "path");
            branch.setAttribute("class", `family-connector family-connector--${side}`);
            branch.setAttribute("d", `M ${parentJoinX} ${treeOrigin.y + averageParentY} V ${parentY} H ${parentX}`);
            svg.append(branch);
        });
    });
}

function renderTree({ center = true } = {}) {
    if (!family) return;
    buildPositions();
    const featured = centerSize();

    const allX = [...nodePositions.values()].map((position) => position.x);
    const allY = [...nodePositions.values()].map((position) => position.y);
    const minX = Math.min(...allX, 0) - Math.max(cardWidth, featured.width) / 2;
    const maxX = Math.max(...allX, 0) + Math.max(cardWidth, featured.width) / 2;
    const minY = Math.min(...allY, 0) - Math.max(cardHeight, featured.height) / 2;
    const maxY = Math.max(...allY, 0) + Math.max(cardHeight, featured.height) / 2;
    const horizontalExtent = Math.max(Math.abs(minX), Math.abs(maxX));
    const verticalExtent = Math.max(Math.abs(minY), Math.abs(maxY));
    const requiredWidth = horizontalExtent * 2 + 112;
    const requiredHeight = verticalExtent * 2 + 84;
    const width = Math.max(requiredWidth, treeViewport.clientWidth);
    const height = Math.max(requiredHeight, treeViewport.clientHeight);

    treeOrigin = { x: width / 2, y: height / 2 };

    treeRoot.replaceChildren();
    treeRoot.style.width = `${width}px`;
    treeRoot.style.height = `${height}px`;

    const connectorLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    connectorLayer.classList.add("connector-layer");
    connectorLayer.setAttribute("width", width);
    connectorLayer.setAttribute("height", height);
    connectorLayer.setAttribute("viewBox", `0 0 ${width} ${height}`);
    connectorLayer.setAttribute("aria-hidden", "true");
    treeRoot.append(connectorLayer);

    const childCard = makeAvatar(family.people.eliza, "eliza", true);
    placeCard(childCard, 0, 0, featured.width, featured.height);
    treeRoot.append(childCard);

    nodePositions.forEach((position, id) => {
        if (id === "eliza") return;
        const person = family.people[id];
        const card = makeAvatar(person, id);
        placeCard(card, position.x, position.y, cardWidth, cardHeight);
        card.dataset.side = position.side;
        treeRoot.append(card);
    });

    renderConnectors(connectorLayer, { width, height });

    if (center) {
        treeViewport.scrollLeft = Math.max(0, treeOrigin.x - treeViewport.clientWidth / 2);
        treeViewport.scrollTop = Math.max(0, treeOrigin.y - treeViewport.clientHeight / 2);
    }
}

function openEditor(personId) {
    editingId = personId;
    pendingPhoto = null;
    const person = family.people[personId];
    const image = editor.querySelector(".lightbox-image");
    const placeholder = editor.querySelector(".editor-placeholder");
    const photoPicker = editor.querySelector(".editor-portrait-button");

    editor.querySelector(".editor-role").textContent = person.role;
    editor.querySelector("#editor-title").textContent = person.name || (canEdit ? `Adicionar ${person.role.toLowerCase()}` : person.role);
    editor.querySelector(".editor-name").value = person.name || "";
    editor.querySelector(".editor-description").value = person.description || "";
    editor.querySelector(".editor-status").textContent = "";
    editor.querySelector(".editor-file").value = "";
    editor.querySelector(".editor-name").readOnly = !canEdit;
    editor.querySelector(".editor-description").readOnly = !canEdit;
    editor.querySelector(".editor-file").disabled = !canEdit;
    photoPicker.disabled = !canEdit;
    editor.querySelector(".remove-photo").hidden = !person.photo;
    editor.querySelector(".editor-upload").hidden = !canEdit;
    editor.querySelector(".save-person").hidden = !canEdit;
    editor.querySelector(".editor-name").readOnly = !canEdit;
    editor.querySelector(".editor-description").readOnly = !canEdit;
    if (!canEdit) {
        editor.querySelector(".remove-photo").hidden = true;
        editor.querySelector(".editor-status").textContent = "Perfil publicado para consulta.";
    }
    image.hidden = !person.photo;
    placeholder.hidden = Boolean(person.photo);
    if (person.photo) image.src = person.photo;
    editor.showModal();
}

function previewPhoto(file) {
    if (!file) return;
    pendingPhoto = file;
    const image = editor.querySelector(".lightbox-image");
    const preview = URL.createObjectURL(file);
    image.src = preview;
    image.hidden = false;
    editor.querySelector(".editor-placeholder").hidden = true;
    editor.querySelector(".remove-photo").hidden = false;
}

async function savePerson(removePhoto = false) {
    if (!editingId) return;
    if (!canEdit) {
        editor.querySelector(".editor-status").textContent = "Edições disponíveis somente no servidor local.";
        return;
    }
    const saveButton = editor.querySelector(".save-person");
    const body = new FormData();
    body.set("name", editor.querySelector(".editor-name").value.trim());
    body.set("description", editor.querySelector(".editor-description").value.trim());
    if (pendingPhoto) body.set("photo", pendingPhoto);
    if (removePhoto) body.set("removePhoto", "1");

    saveButton.disabled = true;
    editor.querySelector(".editor-status").textContent = "Salvando no projeto...";

    try {
        const response = await fetch(`/api/people/${encodeURIComponent(editingId)}`, { method: "PUT", body });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");

        family.people[editingId] = result.person;
        const personName = result.person.name || result.person.role;
        pageStatus.textContent = pendingPhoto ? `Foto e dados de ${personName} salvos localmente em assets/.` : `Dados de ${personName} salvos localmente.`;
        editor.close();
        pendingPhoto = null;
        renderTree({ center: false });
    } catch (error) {
        editor.querySelector(".editor-status").textContent = `${error.message} Confira se node server.js continua aberto.`;
    } finally {
        saveButton.disabled = false;
    }
}

async function loadFamily() {
    try {
        const apiUrl = new URL("api/family", window.location.href);
        const response = await fetch(apiUrl, { cache: "no-store" });
        if (!response.ok) throw new Error("API local indisponível");

        family = await response.json();
        canEdit = true;
        renderTree();
        return;
    } catch {
        try {
            const dataUrl = new URL("assets/people.json", document.baseURI);
            const response = await fetch(dataUrl, { cache: "no-store" });
            if (!response.ok) throw new Error("Não foi possível carregar assets/people.json.");

            family = await response.json();
            canEdit = false;
            renderTree();
            pageStatus.textContent = "Árvore publicada para consulta. Para editar, inicie o servidor local.";
        } catch (error) {
            pageStatus.textContent = `${error.message} Confira se assets/people.json está publicado.`;
            pageStatus.classList.add("photo-status--error");
        }
    }
}

treeRoot.addEventListener("click", (event) => {
    const avatar = event.target.closest(".person-node");
    if (avatar) openEditor(avatar.dataset.personId);
});

editor.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!canEdit && action) return;
    if (action === "choose-photo") editor.querySelector(".editor-file").click();
    if (action === "save") savePerson();
    if (action === "remove-photo") savePerson(true);
});

editor.querySelector(".editor-file").addEventListener("change", (event) => previewPhoto(event.target.files[0]));
editor.querySelector(".lightbox-close").addEventListener("click", () => editor.close());
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && editor.open) editor.close();
});
window.addEventListener("resize", () => requestAnimationFrame(() => renderTree({ center: true })));

loadFamily();
