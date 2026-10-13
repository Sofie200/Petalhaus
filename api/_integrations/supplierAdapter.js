// Fetches the supplier's product file and converts it to OUR model.
// Compare with a normal JSON request:
//   const products = await (await fetch(url)).json()
// Here we have to do every step ourselves.

import { parse } from "csv-parse/sync";
import { XMLParser } from "fast-xml-parser";
import { z } from 'zod';

const BASE_URL = "https://leverantor-api.vercel.app/v1/export/products";
const HEADERS = { "X-Api-Key": process.env.IMPORT_API_KEY ?? "" };

// Delade regler, så att CSV och XML alltid kontrolleras likadant
const ean = z.string().regex(/^\d{8}$|^\d{13}$/, "EAN ska vara 8 eller 13 siffror");
const price = z.string().regex(/^\d+([.,]\d{1,2})?$/, 'Pris ska se ut som "599", "599,00" eller "599.00"');

const CsvRow = z.object({
  ean,
  benamning: z.string().min(1),
  kategori: z.string().min(1),
  pris: price,
  uppdaterad: z.iso.date(),
});

// Samma fält, men <pris> har ett attribut, så texten ligger i "#text"
const XmlRow = z.object({
  ean,
  benamning: z.string().min(1),
  kategori: z.string().min(1),
  pris: z.object({ "#text": price }),
  uppdaterad: z.iso.datetime(),
});

// "599,00" → 599. The Swedish decimal comma must become a dot before Number().
function toNumber(text) {
  return Number(text.replace(",", "."));
}

// An empty stock value means "unknown". We count it as 0 in stock.
function toStock(text) {
  return text === "" ? 0 : Number(text);
}

// Validerar varje rad, hoppar över de trasiga och loggar varför
function validateRows(rows, schema, label) {
  const valid = [];
  let skippedCount = 0;
  for (const [index, raw] of rows.entries()) {
    const result = schema.safeParse(raw);
    if (result.success) {
      valid.push(result.data);
    } else {
      skippedCount++;
      console.warn(`[${label}] Skipping item ${index + 1}:`, z.prettifyError(result.error));
    }
  }
  return { valid, skippedCount };
}

/* --- CSV --- */

export async function getCsvProducts() {
  // 1. Fetch – exactly like with JSON
  const response = await fetch(`${BASE_URL}.csv?bransch=vaxter`, { headers: HEADERS });

  console.log("\n[CSV] 1. Content-Type:", response.headers.get("content-type"));

  // 2. Raw bytes. NOT .json() (it isn't JSON) and NOT .text().
  // The server sends "charset=windows-1252" in Content-Type, but fetch ignores it:
  // .text() ALWAYS decodes as UTF-8. Then "Tröja" → "Tr�ja", because ö is one byte (0xF6)
  // in Windows-1252 but must be two bytes in UTF-8. So we take the bytes and decode them ourselves.
  const buffer = await response.arrayBuffer();
  console.log("[CSV] 2. Number of bytes:", buffer.byteLength);

  // 3. Bytes → text, using the supplier's character encoding.
  // We hardcode 'windows-1252' because we know what this supplier sends. We could read it from
  // Content-Type, but not every supplier sets charset, and some set the wrong one.
  const text = new TextDecoder("windows-1252").decode(buffer);
  console.log("[CSV] 3. Raw text:\n" + text);

  // 4. Text → objects. Every value is still text, which is what we want for ean.
  const rows = parse(text, {
    columns: true, // the first line holds the headers → each row becomes an object
    delimiter: ";", // without it, "599,00" is split into two columns at the comma
    skip_empty_lines: true, // without it, the empty line in the file is an error
    trim: true, // " Jacka " → "Jacka"
  });
  console.log("[CSV] 4. After parse:", rows);

  // 5. Validate each row, skip the broken ones
  const { valid, skippedCount } = validateRows(rows, CsvRow, "CSV");

  // 6. Supplier's fields → our fields, text → number
  const products = valid.map((row) => ({
    ean: row.ean,
    name: row.benamning,
    category: row.kategori,
    price: toNumber(row.pris),
    updated: row.uppdaterad,
  }));

  console.log("[CSV] 5. Our model:", products);

  return { text, rows, products, skippedCount };
}

/* --- XML --- */

const xmlParser = new XMLParser({
  ignoreAttributes: false, // without it, artNr="LEV-1001" disappears
  parseTagValue: false, // keep every value as text. Otherwise ean 0735100197975 → 735100197975

  // Without it, a tag that occurs only once becomes an object instead of a list.
  // LEV-1002 has one <variant>, and a file with one <produkt> would break the same way.
  isArray: (name) => name === "produkt" || name === "variant",
});

export async function getXmlProducts() {
  // 1. Fetch
  const response = await fetch(`${BASE_URL}.xml?bransch=vaxter`, { headers: HEADERS });
  console.log("\n[XML] 1. Content-Type:", response.headers.get("content-type"));

  // 2. This file is UTF-8, so .text() works. It's the file's encoding that matters, not the format:
  // if this XML file had been Windows-1252, we would use arrayBuffer() + TextDecoder like with CSV.
  const text = await response.text();
  console.log("[XML] 2. Raw text:\n" + text);

  // 3. Text → objects. The structure follows the tags in the file.
  const doc = xmlParser.parse(text);
  console.log("[XML] 3. After parse:", JSON.stringify(doc, null, 2));

    // 4. Validate each product, skip the broken ones
  const { valid, skippedCount } = validateRows(doc.katalog.produkt, XmlRow, "XML");

  // 5. Supplier's fields → our fields
  const products = valid.map((p) => ({
    ean: p.ean,
    name: p.benamning,
    category: p.kategori,
    price: toNumber(p.pris["#text"]),
    updated: p.uppdaterad.slice(0, 10), // "2026-09-01T08:00:00.000Z" → "2026-09-01",
  }));
  console.log("[XML] 5. Our model:", products);

  return { text, parsed: doc, products, skippedCount };
}