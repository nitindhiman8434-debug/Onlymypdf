#!/usr/bin/env tsx
import fs from "fs";
import JSZip from "jszip";

const docxPath = process.argv[2];
if (!docxPath) process.exit(1);

async function main() {
  const buf = fs.readFileSync(docxPath);
  const zip = await JSZip.loadAsync(buf);
  const media = Object.keys(zip.files)
    .filter((n) => n.startsWith("word/media/"))
    .sort();

  console.log("Media files:", media.length);
  let total = 0;
  for (const name of media) {
    const data = await zip.file(name)!.async("nodebuffer");
    total += data.length;
    console.log(`${name}: ${data.length} bytes, magic=${data.slice(0, 4).toString("hex")}`);
  }
  console.log("Total media bytes:", total, `(${(total / 1024).toFixed(1)} KB)`);
  console.log("DOCX total:", buf.length);

  const doc = await zip.file("word/document.xml")!.async("string");
  const brokenRefs = (doc.match(/r:embed="[^"]+"/g) ?? []).length;
  const blips = (doc.match(/a:blip/g) ?? []).length;
  const brokenImages = doc.includes("altText") ? 0 : 0;
  console.log("embed refs:", brokenRefs, "blips:", blips);

  // Check for external broken links
  const externals = doc.match(/Target="[^"]+"/g) ?? [];
  console.log("external targets:", externals.slice(0, 5));

  // rels
  const rels = zip.file("word/_rels/document.xml.rels");
  if (rels) {
    const relXml = await rels.async("string");
    const relCount = (relXml.match(/Relationship /g) ?? []).length;
    const imageRels = (relXml.match(/image\//g) ?? []).length;
    console.log("relationships:", relCount, "image rels:", imageRels);
  }
}

main();
