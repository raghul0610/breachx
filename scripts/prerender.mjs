import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const outputPath = resolve(process.cwd(), "dist/index.html");
const html = await readFile(outputPath, "utf8");

const rootPattern = /<div id="root"><\/div>/;
if (!rootPattern.test(html)) {
  throw new Error("Expected an empty #root mount point in dist/index.html; prerender step stopped.");
}

const prerenderedLanding = `<div id="root">
      <main id="seo-prerendered-content">
        <header>
          <p>System design, made visible</p>
          <h1>AI-Powered System Architecture Designer</h1>
          <p>ANCHON helps you turn application ideas into clear system blueprints. Design software architecture visually, explore components and connections, and understand how the parts of a system work together.</p>
        </header>
        <section aria-labelledby="seo-visual-design">
          <h2 id="seo-visual-design">Design software architecture visually</h2>
          <p>Arrange services, APIs, databases, and infrastructure components in a visual architecture. Connect dependencies and follow the flow of requests and data through your system.</p>
        </section>
        <section aria-labelledby="seo-system-blueprints">
          <h2 id="seo-system-blueprints">Turn application ideas into system blueprints</h2>
          <p>Start with an application idea, explore the system boundaries, and use AI to generate a starting architecture that you can inspect and refine.</p>
        </section>
        <section aria-labelledby="seo-capabilities">
          <h2 id="seo-capabilities">Explore system components and connections</h2>
          <p>Understand the roles of application services, API gateways, data stores, authentication, and integrations within a software system.</p>
        </section>
      </main>
    </div>`;

await writeFile(outputPath, html.replace(rootPattern, prerenderedLanding), "utf8");
console.log("Prerendered SEO landing content into dist/index.html");
