#!/usr/bin/env python3
"""Phase 3.2G: two distinct ruled English tables on one page, through local HTTP."""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.util
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

HELPER_PATH = Path(__file__).with_name("phase3-english-table-corpus.py")
spec = importlib.util.spec_from_file_location("english_multitable_helpers", HELPER_PATH)
table = importlib.util.module_from_spec(spec)
spec.loader.exec_module(table)
word, ROOT = table.word, table.ROOT
ARTIFACT_ROOT = ROOT / "tmp" / "pdfs" / "phase3.2g-english-multitable"
REPORT_ROOT = ROOT / "quality" / "phase3-english-multitable"
inspect_docx = table.inspect_docx
expected_tables = table.expected_tables
LIMITATIONS = [
    "Four fixed synthetic English scans, each exactly one page; no universal document-quality claim.",
    "Positive cases require two vertically separated, fully ruled four-column tables, each with a header and three body rows.",
    "Exact complete native matrices and complete ordered visible text are required; whitespace normalization does not alter characters, numbers or cell boundaries.",
    "Repeated headers and a repeated service name have distinct row identifiers and amounts; repetitions must not be silently dropped or duplicated.",
    "The negative borderless two-group memo requires zero native tables and all prose in order.",
    "Independent source DOCX/PDF validation and visible-grid separation checks precede image-only rasterization.",
    "Independent LibreOffice output rendering verifies page count, dimensions and complete text; source and output PNGs need separate visual inspection.",
    "No merged cells, side-by-side tables, broken ruling, skewed scans, arbitrary borderless invoices or language-quality claims are included.",
    "No previous corpus is generated or run; helpers are imported without modifying their files or reports.",
    "Only loopback HTTP is accepted; no paid services, cloud deployment, downloads or other-language fixture generation.",
]


def definitions() -> list[dict]:
    header = ["Item ID", "Description", "Qty", "Line total"]

    def page(first_title, first_intro, first_rows, between, second_title, second_rows, ending):
        return [word.p(first_title, True), word.p(first_intro),
                {"kind": "table", "rows": [header[:], *first_rows]},
                word.p(between), word.p(second_title, True),
                {"kind": "table", "rows": [header[:], *second_rows]}, word.p(ending)]

    first_rows = [["00421", "Analysis package", "2", "240.50"],
                  ["00632", "Review service", "3", "135.30"],
                  ["00874", "Archive support", "1", "19.95"]]
    second_rows = [["00235", "Delivery package", "2", "320.50"],
                   ["00456", "Review service", "3", "145.30"],
                   ["00678", "Final support", "1", "49.95"]]
    simple_between = "Planning total is 395.75 USD. The next invoice covers a separate delivery stage."
    simple = page("Planning services", "Planning invoice 004218 covers the completed work shown in the first table.",
                  first_rows, simple_between, "Delivery services",
                  second_rows, "Delivery total is 515.75 USD. Keep both invoices in order and retain this final paragraph.")

    wrapped_first = [["00542", "Monthly analysis and reporting package for the research team", "2", "280.50"],
                     ["00763", "Review service", "3", "165.30"],
                     ["00985", "Archive support", "1", "29.95"]]
    wrapped_second = [["00146", "Final delivery service and document preparation for the project", "2", "420.50"],
                      ["00357", "Review service", "3", "185.30"],
                      ["00579", "Final support", "1", "59.95"]]
    wrapped_between = "Research total is 475.75 USD. The delivery invoice below belongs to the next stage."
    wrapped = page("Research services", "Research invoice 005329 includes a complete description inside its first item cell.",
                   wrapped_first, wrapped_between, "Project delivery services",
                   wrapped_second, "Delivery total is 665.75 USD. Keep each long description with its own identifier and amount.")

    landscape_first = [["00124", "Planning package", "2", "220.50"],
                       ["00345", "Review service", "3", "125.30"],
                       ["00567", "Record storage", "1", "39.95"]]
    landscape_second = [["00718", "Delivery package", "2", "520.50"],
                        ["00929", "Review service", "3", "245.30"],
                        ["00241", "Final support", "1", "69.95"]]
    landscape_between = "Planning total is 385.75 USD. The next invoice records a separate delivery stage."
    landscape = page("Landscape planning services", "Planning invoice 006431 lists the first group of completed services.",
                     landscape_first, landscape_between, "Landscape delivery services",
                     landscape_second, "Delivery total is 835.75 USD. This final paragraph belongs after both tables on this page.")

    memo = [word.p("Planning reference notes", True),
            word.p("The first group contains plain reference notes without table borders."),
            word.p("Reference 006731\tApproved amount 81.25 USD"),
            word.p("Reference 008952\tApproved amount 42.60 USD"),
            word.p("Reference 003174\tApproved amount 19.95 USD"),
            word.p("The first group is complete. The next group records separate delivery notes."),
            word.p("Delivery reference notes", True),
            word.p("Reference 007842\tApproved amount 91.25 USD"),
            word.p("Reference 009163\tApproved amount 52.60 USD"),
            word.p("Reference 004285\tApproved amount 29.95 USD"),
            word.p("Keep both note groups in order and retain this complete final paragraph.")]
    cases = [
        {"caseId": "english-two-tables-portrait-scan", "pages": [simple], "interTableParagraph": simple_between},
        {"caseId": "english-two-tables-wrapped-scan", "pages": [wrapped], "interTableParagraph": wrapped_between,
         "requiredWrappedDescriptions": [wrapped_first[0][1], wrapped_second[0][1]]},
        {"caseId": "english-two-tables-landscape-scan", "pages": [landscape], "interTableParagraph": landscape_between,
         "pageSizesPoints": [[792, 612]]},
        {"caseId": "english-two-groups-borderless-scan", "pages": [memo], "negativeControl": True},
    ]
    for case in cases:
        case["inputKind"] = "scan"
        case["numericValues"] = re.findall(r"\d+(?:\.\d+)?", "\n".join(text for page in case["pages"] for text in word.page_text(page)))
    return cases


_single_table_source_evidence = table.grid_evidence


def grid_evidence(path: Path, case: dict) -> dict:
    """Augment existing source checks with independent two-grid/prose geometry."""
    import fitz

    result = _single_table_source_evidence(path, case)
    geometry = []
    with fitz.open(path) as pdf:
        for index, page in enumerate(pdf):
            horizontal, vertical = [], []
            for drawing in page.get_drawings():
                if drawing.get("color") != (0.0, 0.0, 0.0) or drawing.get("width", 0) < 0.7:
                    continue
                for item in drawing["items"]:
                    if item[0] != "l":
                        continue
                    a, b = item[1:]
                    if abs(a.y - b.y) < 0.1 and abs(a.x - b.x) > 25:
                        horizontal.append((min(a.x, b.x), max(a.x, b.x), a.y))
                    if abs(a.x - b.x) < 0.1 and abs(a.y - b.y) > 25:
                        vertical.append((a.x, min(a.y, b.y), max(a.y, b.y)))
            groups = []
            for x, top, bottom in sorted(vertical, key=lambda line: line[1]):
                if groups and top <= groups[-1]["bottom"] + 1:
                    groups[-1]["bottom"] = max(groups[-1]["bottom"], bottom)
                    groups[-1]["xs"].append(round(x, 1))
                else:
                    groups.append({"top": top, "bottom": bottom, "xs": [round(x, 1)]})
            for group in groups:
                group["verticalAxes"] = sorted(set(group.pop("xs")))
                group["horizontalAxes"] = sorted({round(y, 1) for _, _, y in horizontal if group["top"] - 1 <= y <= group["bottom"] + 1})
                group["completeFourByFourGrid"] = len(group["verticalAxes"]) == 5 and len(group["horizontalAxes"]) == 5
            expected_count = sum(block["kind"] == "table" for block in case["pages"][index])
            inter_rects = [list(rect) for rect in page.search_for(case["interTableParagraph"])] if expected_count else []
            between_passed = (bool(inter_rects) and len(groups) == 2
                              and all(rect[1] > groups[0]["bottom"] and rect[3] < groups[1]["top"] for rect in inter_rects)) if expected_count else True
            passed = len(groups) == expected_count and all(group["completeFourByFourGrid"] for group in groups) and between_passed
            geometry.append({"page": index + 1, "expectedSeparateTableCount": expected_count, "actualSeparateTableCount": len(groups),
                             "grids": groups, "interTableParagraphRects": inter_rects, "interTableParagraphInsideGap": between_passed, "passed": passed})
    result["separateTableGeometry"] = geometry
    result["passed"] = result["passed"] and all(page["passed"] for page in geometry)
    return result


# Adapt this private imported module instance, never a previous file/report.
# Its generator calls this stronger source check before rasterizing an upload.
table.grid_evidence = grid_evidence
table.ARTIFACT_ROOT = ARTIFACT_ROOT


def oracle() -> dict:
    return {"validatorSha256": word.digest(Path(__file__)),
            "fixtureDefinitionsSha256": hashlib.sha256(json.dumps(definitions(), sort_keys=True).encode()).hexdigest(),
            "tableHelperSha256": word.digest(HELPER_PATH),
            "wordHelperSha256": word.digest(Path(__file__).with_name("phase3-english-word-corpus.py")),
            "transportHelperSha256": word.digest(Path(__file__).with_name("phase3-document-corpus.py"))}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:3001")
    parser.add_argument("--generate-only", action="store_true")
    parser.add_argument("--run-label", required=True)
    parser.add_argument("--case", action="append", choices=[case["caseId"] for case in definitions()])
    parser.add_argument("--report", type=Path)
    parser.add_argument("--reuse-sources", type=Path)
    parser.add_argument("--timeout", type=float, default=180)
    parser.add_argument("--libreoffice")
    args = parser.parse_args()
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", args.run_label):
        parser.error("run-label must contain 1-64 lowercase letters, digits or hyphens")
    if not 1 <= args.timeout <= 600:
        parser.error("timeout must be between 1 and 600 seconds")
    if args.generate_only and args.reuse_sources:
        parser.error("generate-only and reuse-sources cannot be combined")
    base = word.transport_module.validate_base_url(args.base_url)
    directory = ARTIFACT_ROOT / args.run_label
    report_path = args.report or REPORT_ROOT / (args.run_label + "-report.json")
    if directory.exists() or report_path.exists():
        parser.error("Existing run/report cannot be overwritten; choose a fresh label and report")
    selected = [case for case in definitions() if not args.case or case["caseId"] in args.case]
    report = {"schemaVersion": 1, "phase": "3.2G", "runLabel": args.run_label,
              "generatedAt": datetime.now(timezone.utc).isoformat(), "baseUrl": base,
              "generateOnly": args.generate_only, **oracle(), "limitations": LIMITATIONS,
              "manualVisualQa": {"status": "required", "instructions": "Inspect all source/output PNGs for two separate tables, prose between them, wrapping, clipping and page completeness."},
              "cases": [], "results": []}
    table.configure_artifacts(directory)
    directory.mkdir(parents=True, exist_ok=False)
    try:
        office = word.find_office(args.libreoffice)
        sources = None
        if args.reuse_sources:
            previous = json.loads(args.reuse_sources.read_text(encoding="utf-8"))
            if not previous.get("generateOnly") or any(previous.get(key) != value for key, value in oracle().items()):
                raise ValueError("Reused source report must be generate-only with identical frozen definitions and helper/validator hashes")
            sources = {case["caseId"]: case for case in previous["cases"]}
            report["reusedSourceReport"] = {"path": str(args.reuse_sources), "sha256": word.digest(args.reuse_sources)}
        for case in selected:
            source = table.generate_source(case, office) if sources is None else copy.deepcopy(sources[case["caseId"]]["source"])
            if sources is not None:
                if not source["passed"]:
                    raise ValueError("Cannot reuse invalid source")
                for path_key, hash_key in (("inputPath", "inputSha256"), ("literalDocxPath", "literalDocxSha256")):
                    if word.digest(ROOT / source[path_key]) != source[hash_key]:
                        raise ValueError("Source artifact hash changed: " + path_key)
                original = source["trustedOriginal"]
                if word.digest(ROOT / original["pdfPath"]) != original["pdfSha256"]:
                    raise ValueError("Trusted original PDF hash changed")
            item = {**case, "source": source}
            report["cases"].append(item)
            if source["passed"] and not args.generate_only:
                result = table.convert(item, base, args.timeout, office)
                report["results"].append(result)
                print(json.dumps({"caseId": case["caseId"], "status": result["status"], "httpStatus": result.get("httpStatus")}), flush=True)
    except Exception as exc:
        report["setupError"] = str(exc)[:15000]
    failed_sources = sum(not case["source"]["passed"] for case in report["cases"])
    statuses = Counter(result["status"] for result in report["results"])
    complete = len(report["cases"]) == len(selected) and not failed_sources and not report.get("setupError")
    passed = complete and len(report["results"]) == len(selected) and statuses["passed"] == len(selected)
    report["summary"] = {"casesSelected": len(selected), "fixturesValidated": len(report["cases"]), "fixturesFailed": failed_sources,
                         "routesTested": len(report["results"]), "passed": statuses["passed"], "failed": statuses["failed"], "errors": statuses["error"],
                         "allPassed": None if args.generate_only else bool(passed)}
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with report_path.open("x", encoding="utf-8") as handle:
        handle.write(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"report": str(report_path), "summary": report["summary"]}), flush=True)
    return 0 if (complete if args.generate_only else passed) else 1


if __name__ == "__main__":
    raise SystemExit(main())
