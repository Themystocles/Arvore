const family = {
    child: { name: "Maria Eliza", image: "images/Eliza.jpg" },
    branches: [
        {
            side: "maternal",
            generations: [
                {
                    title: "Mãe",
                    people: [{ name: "Mãe", image: "images/Maryanna Silva Holanda.jpg", fullName: "Maryanna Silva Holanda Lopes" }]
                },
                {
                    title: "Avós maternos",
                    people: [
                        { name: "Pai da Mãe", image: "images/humberto holanda.jpg" },
                        { name: "Mãe da Mãe", image: "images/jane holanda.jpg" }
                    ]
                },
                {
                    title: "Bisavós maternos",
                    people: Array.from({ length: 4 }, (_, index) => ({ name: `Bisavó ${index + 1}` }))
                },
                {
                    title: "Trisavós maternos",
                    people: Array.from({ length: 8 }, (_, index) => ({ name: `Trisavó ${index + 1}` }))
                },
                {
                    title: "Tetravós maternos",
                    people: [
                        { name: "Tetravó 1" },
                        { name: "Tetravó 2" },
                        { gap: true },
                        { name: "Tetravó 32" }
                    ]
                }
            ]
        },
        {
            side: "paternal",
            generations: [
                {
                    title: "Pai",
                    people: [{ name: "Themystocles", image: "images/Themystocles.jpg", fullName: "Themystocles Washington Da Motta Lopes" }]
                },
                {
                    title: "Avós paternos",
                    people: [
                        { name: "Ronaldo Lopes", image: "images/Francisco ronaldo Lopes.jpg" },
                        { name: "Socorro Mota", image: "images/Socorro Mota.jpg" }
                    ]
                },
                {
                    title: "Bisavós paternos",
                    people: [
                        { name: "Bisavó 1", image: "images/Vo Dede.jpg" },
                        { name: "Bisavó 2", image: "images/vo isabel.jpg" },
                        { name: "Bisavó 3", image: "images/joaquim mota.jpg" },
                        { name: "Bisavó 4", image: "images/Maria de Lourdes Mota.jpg" }
                    ]
                },
                {
                    title: "Trisavós paternos",
                    people: [
                        { name: "Trisavó 1" },
                        { name: "Trisavó 2" },
                        { name: "Trisavó 3" },
                        { name: "Trisavó 4" },
                        { name: "Trisavó 5", image: "images/José Arimateia.jpg" },
                        { name: "Trisavó 6", image: "images/Francisca casemira.jpg" },
                        { name: "Trisavó 7", image: "images/vô conseição.jpg" },
                        { name: "Trisavó 8", image: "images/vó conseição.jpg" }
                    ]
                },
                {
                    title: "Tetravós paternos",
                    people: [
                        { name: "Tetravó 1" },
                        { name: "Tetravó 2", image: "images/Alves.jpg" },
                        { gap: true },
                        { name: "Tetravó 32" }
                    ]
                }
            ]
        }
    ]
};

function createPerson(person, featured = false) {
    const card = document.createElement("article");
    card.className = `person-card${featured ? " person-card--featured" : ""}${person.gap ? " person-card--gap" : ""}`;

    if (person.gap) {
        card.setAttribute("aria-label", "Outros antepassados");
        card.textContent = "···";
        return card;
    }

    if (person.image) {
        const portraitButton = document.createElement("button");
        portraitButton.className = "portrait-button";
        portraitButton.type = "button";
        portraitButton.setAttribute("aria-label", `Ampliar foto de ${person.fullName || person.name}`);
        portraitButton.dataset.personName = person.fullName || person.name;

        const portrait = document.createElement("img");
        portrait.className = "portrait";
        portrait.src = person.image;
        portrait.alt = "";
        portrait.loading = "lazy";
        portrait.decoding = "async";
        portraitButton.append(portrait);
        card.append(portraitButton);
    } else {
        const placeholder = document.createElement("span");
        placeholder.className = "portrait portrait--empty";
        placeholder.setAttribute("aria-hidden", "true");
        placeholder.textContent = "?";
        card.append(placeholder);
    }

    const details = document.createElement("div");
    details.className = "person-details";

    const name = document.createElement("span");
    name.className = "person-name";
    name.textContent = person.name;
    details.append(name);

    if (person.fullName && person.fullName !== person.name) {
        const fullName = document.createElement("span");
        fullName.className = "person-full-name";
        fullName.textContent = person.fullName;
        details.append(fullName);
    }

    card.append(details);

    if (person.fullName) card.title = person.fullName;
    return card;
}

function createGeneration(generation, index) {
    const column = document.createElement("section");
    const isLargeGeneration = generation.people.length >= 8;
    column.className = `generation${isLargeGeneration ? " generation--grid" : ""}`;

    const heading = document.createElement("h2");
    heading.className = "generation-title";
    heading.textContent = generation.title;
    column.append(heading);

    const people = document.createElement("div");
    people.className = `people-list${isLargeGeneration ? " people-list--grid" : ""}`;
    people.setAttribute("aria-label", `${generation.title}, geração ${index + 2}`);

    let couple;
    let coupleSize = 0;
    const finishCouple = () => {
        if (couple && coupleSize === 1) couple.classList.add("family-couple--single");
        couple = null;
        coupleSize = 0;
    };

    generation.people.forEach((person, personIndex) => {
        if (person.gap) {
            finishCouple();
            couple = document.createElement("div");
            couple.className = "family-couple family-couple--single";
            people.append(couple);
            couple.append(createPerson(person));
            couple = null;
            return;
        }

        if (!couple) {
            couple = document.createElement("div");
            couple.className = "family-couple";
            people.append(couple);
        }

        couple.append(createPerson(person));
        coupleSize += 1;
        if (coupleSize === 2 || personIndex === generation.people.length - 1 || generation.people[personIndex + 1]?.gap) {
            finishCouple();
        }
    });

    column.append(people);
    return column;
}

function renderFamilyTree() {
    const tree = document.querySelector("#family-tree");

    family.branches.forEach((branch) => {
        const section = document.createElement("section");
        section.className = `family-branch family-branch--${branch.side}`;
        section.setAttribute("aria-label", `Ramo ${branch.side === "maternal" ? "materno" : "paterno"}`);
        branch.generations.forEach((generation, index) => section.append(createGeneration(generation, index)));
        tree.append(section);

        if (branch.side === "maternal") {
            const center = document.createElement("section");
            center.className = "family-center";
            center.setAttribute("aria-label", "Pessoa central da árvore");

            const heading = document.createElement("h2");
            heading.className = "generation-title";
            heading.textContent = "Filha";
            center.append(heading, createPerson(family.child, true));
            tree.append(center);
        }
    });
}

renderFamilyTree();

function centerTreeOnChild() {
    const viewport = document.querySelector(".tree-scroll");
    const child = document.querySelector(".family-center");
    const viewportBounds = viewport.getBoundingClientRect();
    const childBounds = child.getBoundingClientRect();
    viewport.scrollLeft += childBounds.left + childBounds.width / 2 - (viewportBounds.left + viewportBounds.width / 2);
    centerRootsInViewport();
}

function centerRootsInViewport() {
    const viewport = document.querySelector(".tree-scroll");
    const roots = document.querySelector(".root-illustration");
    roots.style.left = `${viewport.scrollLeft + viewport.clientWidth / 2}px`;
}

document.querySelector(".tree-scroll").addEventListener("scroll", centerRootsInViewport, { passive: true });
requestAnimationFrame(centerTreeOnChild);
window.addEventListener("resize", centerTreeOnChild);

const lightbox = document.querySelector("#photo-lightbox");

document.querySelector("#family-tree").addEventListener("click", (event) => {
    const portraitButton = event.target.closest(".portrait-button");
    if (!portraitButton) return;

    const image = portraitButton.querySelector("img");
    const enlargedImage = lightbox.querySelector(".lightbox-image");
    enlargedImage.src = image.src;
    enlargedImage.alt = portraitButton.dataset.personName;
    enlargedImage.hidden = false;
    lightbox.querySelector(".lightbox-caption").textContent = portraitButton.dataset.personName;
    lightbox.showModal();
});

lightbox.querySelector(".lightbox-close").addEventListener("click", () => lightbox.close());

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && lightbox.open) lightbox.close();
});