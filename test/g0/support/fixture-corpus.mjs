import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fixtureDirectory = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

export async function loadFixtureCorpus() {
  const names = (await readdir(fixtureDirectory)).filter((name) => name.endsWith(".json")).sort();
  return Promise.all(names.map(async (name) => {
    const document = JSON.parse(await readFile(join(fixtureDirectory, name), "utf8"));
    return { name, ...document };
  }));
}
