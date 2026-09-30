import type { Garden, LifeEventId, Plant, PlantEvent } from "./garden-data";
import { plantEvents } from "./garden-logic";
import { lifeEventForPlantEvent } from "./plant-life";
import {
  localizedLibraryName,
  type GardenLibraryManifest,
  type GardenLibraryEntry,
} from "./garden-library";
import { ui, type UiLanguage } from "./ui-copy";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DAY_MS = 86_400_000;

export type GardenExportInput = {
  gardens: readonly Garden[];
  plants: readonly Plant[];
  events: readonly PlantEvent[];
  language: UiLanguage;
  catalog?: GardenLibraryManifest | null;
  exportDate?: Date;
};

type ExportRow = [string, string, string, Date | null, number | null, string];

type Milestone = {
  lifeEvent: LifeEventId;
  event: PlantEvent;
};

const MILESTONE_LIFE_EVENTS = new Set<LifeEventId>([
  "planted",
  "germinated",
  "sprouted",
  "growth_observed",
  "flowered",
  "fruited",
  "harvested",
  "regrowth",
  "propagated",
  "ended",
  "moved",
  "transplanted",
  "damaged",
  "recovered",
]);

function xmlEscape(value: string) {
  return value
    .split("")
    .filter(
      (character) =>
        character.charCodeAt(0) >= 32 ||
        character === "\n" ||
        character === "\t" ||
        character === "\r",
    )
    .join("")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(column: number) {
  let value = column;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function dateKeyFromValue(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localDateKey(date: Date) {
  return dateKeyFromValue(date)!;
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function excelSerialFromDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS) + 25569;
}

function daysBetween(start: string, end: string) {
  return Math.max(
    0,
    Math.round(
      (Date.UTC(...(end.split("-").map(Number) as [number, number, number])) -
        Date.UTC(...(start.split("-").map(Number) as [number, number, number]))) /
        DAY_MS,
    ),
  );
}

function dateForEvent(event: PlantEvent, exportDateKey: string) {
  const exact = dateKeyFromValue(event.occurredAt);
  if (exact) return exact;
  const fallback = dateFromKey(exportDateKey);
  fallback.setDate(fallback.getDate() - Math.max(0, event.daysAgo));
  return localDateKey(fallback);
}

function activePositions(garden: Garden) {
  return (garden.backendPositions ?? [])
    .filter((position) => position.active !== false)
    .slice()
    .sort(
      (left, right) =>
        (left.levelNumber ?? 1) - (right.levelNumber ?? 1) ||
        (left.rowNumber ?? left.gridY ?? Number.MAX_SAFE_INTEGER) -
          (right.rowNumber ?? right.gridY ?? Number.MAX_SAFE_INTEGER) ||
        (left.columnNumber ?? left.gridX ?? Number.MAX_SAFE_INTEGER) -
          (right.columnNumber ?? right.gridX ?? Number.MAX_SAFE_INTEGER) ||
        left.number - right.number,
    );
}

function positionLabel(garden: Garden, position: NonNullable<Garden["backendPositions"]>[number]) {
  return position.label?.trim() || `Pod ${position.number}`;
}

function catalogEntryForPlant(plant: Plant, catalog?: GardenLibraryManifest | null) {
  if (!catalog || !plant.libraryPlantId) return undefined;
  return catalog.entries.find((entry) => entry.libraryPlantId === plant.libraryPlantId);
}

function plantNames(plant: Plant, entry: GardenLibraryEntry | undefined) {
  const fallback = plant.libraryIdentitySnapshot?.commonName || plant.species || plant.name;
  const english = entry?.commonName || fallback;
  const spanish = entry ? localizedLibraryName(entry, "es") : fallback;
  return { english, spanish };
}

function localizedMilestoneLabel(lifeEvent: LifeEventId, language: UiLanguage) {
  const keyByLifeEvent: Partial<Record<LifeEventId, Parameters<typeof ui>[1]>> = {
    growth_observed: "lifeEvent_growth_observed",
    flowered: "lifeEvent_flowered",
    fruited: "lifeEvent_fruited",
    harvested: "lifeEvent_harvested",
    regrowth: "lifeEvent_regrowth",
    propagated: "lifeEvent_propagated",
    transplanted: "lifeEvent_transplanted",
    damaged: "lifeEvent_damaged",
    recovered: "lifeEvent_recovered",
    ended: "lifeEvent_ended",
    moved: "moved",
    planted: "planted",
    germinated: "germinated",
    sprouted: "sprouted",
  };
  const key = keyByLifeEvent[lifeEvent];
  return key ? ui(language, key) : lifeEvent;
}

function latestMilestone(events: readonly PlantEvent[], plantId: string): Milestone | null {
  const event = plantEvents([...events], plantId).find((candidate) => {
    if (candidate.provenance === "inferred" || candidate.type === "ai") return false;
    const lifeEvent = lifeEventForPlantEvent(candidate);
    return lifeEvent !== null && MILESTONE_LIFE_EVENTS.has(lifeEvent);
  });
  if (!event) return null;
  const lifeEvent = lifeEventForPlantEvent(event);
  return lifeEvent ? { lifeEvent, event } : null;
}

function safeSheetBase(name: string) {
  const safe = name
    .replaceAll("\\", " ")
    .replaceAll("/", " ")
    .replaceAll(":", " ")
    .replaceAll("?", " ")
    .replaceAll("*", " ")
    .replaceAll("[", " ")
    .replaceAll("]", " ")
    .split("")
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("")
    .trim()
    .replace(/\s+/g, " ");
  return (safe || "Garden").slice(0, 31);
}

export function safeWorksheetNames(gardens: readonly Garden[]) {
  const used = new Set<string>();
  return gardens.map((garden) => {
    const base = safeSheetBase(garden.name);
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate.toLocaleLowerCase())) {
      const suffixText = ` (${suffix})`;
      candidate = `${base.slice(0, 31 - suffixText.length)}${suffixText}`;
      suffix += 1;
    }
    used.add(candidate.toLocaleLowerCase());
    return { gardenId: garden.id, name: candidate };
  });
}

function methodLabel(method: Garden["cultivationMethod"], language: UiLanguage) {
  if (!method) return language === "es" ? "No registrado" : "Not recorded";
  const labels = {
    hydroponic: ["Hydroponic", "Hidroponía"],
    soil: ["Soil", "Suelo"],
    container: ["Container", "Contenedor"],
  } as const;
  return labels[method][language === "es" ? 1 : 0];
}

function metadataRows(
  garden: Garden,
  language: UiLanguage,
  exportDate: Date,
  positions: ReturnType<typeof activePositions>,
) {
  const capacity = garden.machine?.pods ?? positions.length;
  const activeCount = positions.length;
  return [
    [garden.name, null],
    [
      ui(language, "system"),
      garden.machine?.name || (language === "es" ? "No registrado" : "Not recorded"),
    ],
    [
      ui(language, "positions"),
      `${capacity} / ${activeCount} ${language === "es" ? "activas" : "active"}`,
    ],
    [ui(language, "growingSetup"), methodLabel(garden.cultivationMethod, language)],
    [ui(language, "date"), exportDate],
  ] as const;
}

function rowsForGarden(
  garden: Garden,
  plants: readonly Plant[],
  events: readonly PlantEvent[],
  catalog: GardenLibraryManifest | null | undefined,
  language: UiLanguage,
  exportDate: Date,
): ExportRow[] {
  const exportDateKey = localDateKey(exportDate);
  const plantByPosition = new Map(
    plants
      .filter(
        (plant) => plant.gardenId === garden.id && !plant.cycleClosed && plant.backendPositionId,
      )
      .map((plant) => [plant.backendPositionId!, plant] as const),
  );
  return activePositions(garden).map((position) => {
    const plant = plantByPosition.get(position.id);
    if (!plant) return [positionLabel(garden, position), "", "", null, null, ""];
    const plantedKey =
      plant.plantedOn && plant.plantedDatePrecision !== "unknown"
        ? dateKeyFromValue(plant.plantedOn)
        : null;
    const milestone = latestMilestone(events, plant.id);
    const milestoneDateKey = milestone ? dateForEvent(milestone.event, exportDateKey) : null;
    const entry = catalogEntryForPlant(plant, catalog);
    const names = plantNames(plant, entry);
    return [
      positionLabel(garden, position),
      names.english,
      names.spanish,
      plantedKey ? dateFromKey(plantedKey) : null,
      plantedKey ? daysBetween(plantedKey, exportDateKey) : null,
      milestone && milestoneDateKey
        ? `${localizedMilestoneLabel(milestone.lifeEvent, language)} · ${dateFromKey(milestoneDateKey).toLocaleDateString(language === "es" ? "es-ES" : "en-US", { month: "short", day: "numeric", year: "numeric" })}`
        : "",
    ];
  });
}

function cellReference(row: number, column: number) {
  return `${columnName(column)}${row}`;
}

function cellXml(row: number, column: number, value: string | number | Date | null, style = 0) {
  if (value === null || value === "") return "";
  const reference = cellReference(row, column);
  if (value instanceof Date) {
    const key = localDateKey(value);
    return `<c r="${reference}" s="${style}" t="n"><v>${excelSerialFromDateKey(key)}</v></c>`;
  }
  if (typeof value === "number")
    return `<c r="${reference}" s="${style}" t="n"><v>${value}</v></c>`;
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
}

function worksheetXml(
  garden: Garden,
  language: UiLanguage,
  exportDate: Date,
  positions: ReturnType<typeof activePositions>,
  rows: ExportRow[],
) {
  const metadata = metadataRows(garden, language, exportDate, positions);
  const header = ["Position", "Plant EN", "Plant ES", "Planted", "Total days", "Last milestone"];
  const allRows: Array<Array<string | number | Date | null>> = [
    ...metadata,
    [null, null],
    header,
    ...rows,
  ];
  const sheetRows = allRows
    .map((values, index) => {
      const rowNumber = index + 1;
      const cells = values
        .map((value, columnIndex) => {
          const column = columnIndex + 1;
          const style =
            rowNumber === 1
              ? 1
              : rowNumber >= 2 && rowNumber <= 5 && column === 1
                ? 2
                : rowNumber === 7
                  ? 3
                  : value instanceof Date
                    ? language === "es"
                      ? 5
                      : 4
                    : rowNumber >= 8 && column === 5
                      ? 6
                      : 0;
          return cellXml(rowNumber, column, value, style);
        })
        .join("");
      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join("");
  const lastRow = Math.max(7, allRows.length);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:F${lastRow}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><cols><col min="1" max="1" width="22" customWidth="1"/><col min="2" max="3" width="24" customWidth="1"/><col min="4" max="4" width="16" customWidth="1"/><col min="5" max="5" width="12" customWidth="1"/><col min="6" max="6" width="30" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData><mergeCells count="1"><mergeCell ref="A1:F1"/></mergeCells><autoFilter ref="A7:F${lastRow}"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="mmm d, yyyy"/><numFmt numFmtId="165" formatCode="d mmm yyyy"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="16"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF315B4F"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0"/><xf numFmtId="0" fontId="2" fillId="1" borderId="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="right"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleMedium9"/></styleSheet>`;
}

function workbookXml(sheetNames: readonly string[]) {
  const sheets = sheetNames
    .map(
      (name, index) =>
        `<sheet name="${xmlEscape(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr defaultThemeVersion="124226"/><sheets>${sheets}</sheets></workbook>`;
}

function workbookRelationships(sheetCount: number) {
  const sheets = Array.from(
    { length: sheetCount },
    (_, index) =>
      `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets}<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function contentTypes(sheetCount: number) {
  const sheets = Array.from(
    { length: sheetCount },
    (_, index) =>
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
}

function relationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function littleEndian(value: number, size: 2 | 4) {
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  if (size === 2) view.setUint16(0, value, true);
  else view.setUint32(0, value >>> 0, true);
  return bytes;
}

function concatBytes(...parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function zipStore(files: Record<string, Uint8Array>) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const fileNames = Object.keys(files);
  for (const name of fileNames) {
    const nameBytes = new TextEncoder().encode(name);
    const data = files[name]!;
    const checksum = crc32(data);
    const local = concatBytes(
      littleEndian(0x04034b50, 4),
      littleEndian(20, 2),
      littleEndian(0, 2),
      littleEndian(0, 2),
      littleEndian(0, 2),
      littleEndian(0, 2),
      littleEndian(checksum, 4),
      littleEndian(data.length, 4),
      littleEndian(data.length, 4),
      littleEndian(nameBytes.length, 2),
      littleEndian(0, 2),
      nameBytes,
      data,
    );
    localParts.push(local);
    const central = concatBytes(
      littleEndian(0x02014b50, 4),
      littleEndian(20, 2),
      littleEndian(20, 2),
      littleEndian(0, 2),
      littleEndian(0, 2),
      littleEndian(0, 2),
      littleEndian(0, 2),
      littleEndian(checksum, 4),
      littleEndian(data.length, 4),
      littleEndian(data.length, 4),
      littleEndian(nameBytes.length, 2),
      littleEndian(0, 2),
      littleEndian(0, 2),
      littleEndian(0, 2),
      littleEndian(0, 2),
      littleEndian(0, 4),
      littleEndian(offset, 4),
      nameBytes,
    );
    centralParts.push(central);
    offset += local.length;
  }
  const centralDirectory = concatBytes(...centralParts);
  const localDirectory = concatBytes(...localParts);
  const end = concatBytes(
    littleEndian(0x06054b50, 4),
    littleEndian(0, 2),
    littleEndian(0, 2),
    littleEndian(fileNames.length, 2),
    littleEndian(fileNames.length, 2),
    littleEndian(centralDirectory.length, 4),
    littleEndian(localDirectory.length, 4),
    littleEndian(0, 2),
  );
  return concatBytes(localDirectory, centralDirectory, end);
}

function textBytes(value: string) {
  return new TextEncoder().encode(value);
}

export function buildGardenExportWorkbook(input: GardenExportInput) {
  if (!input.gardens.length)
    throw new Error(
      input.language === "es"
        ? "No hay jardines para exportar."
        : "There are no gardens to export.",
    );
  const exportDate = input.exportDate ?? new Date();
  const names = safeWorksheetNames(input.gardens);
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": textBytes(contentTypes(input.gardens.length)),
    "_rels/.rels": textBytes(relationshipsXml()),
    "xl/workbook.xml": textBytes(workbookXml(names.map((item) => item.name))),
    "xl/_rels/workbook.xml.rels": textBytes(workbookRelationships(input.gardens.length)),
    "xl/styles.xml": textBytes(stylesXml()),
  };
  input.gardens.forEach((garden, index) => {
    const positions = activePositions(garden);
    const rows = rowsForGarden(
      garden,
      input.plants,
      input.events,
      input.catalog,
      input.language,
      exportDate,
    );
    files[`xl/worksheets/sheet${index + 1}.xml`] = textBytes(
      worksheetXml(garden, input.language, exportDate, positions, rows),
    );
  });
  const dateKey = localDateKey(exportDate);
  return {
    blob: new Blob([zipStore(files)], { type: XLSX_MIME }),
    filename: `garden-export-${dateKey}.xlsx`,
    sheetNames: names.map((item) => item.name),
  };
}
