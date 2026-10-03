const fs = require("node:fs");
const path = require("node:path");

// Optional project-local Windows runtime. Never change the machine's PATH or
// override an explicitly configured OCR installation.
function localOcrEnvironment(repo, env = process.env, exists = fs.existsSync) {
  const result = { ...env };
  const executable = path.join(repo, ".local-tools", "tesseract", "tesseract.exe");
  const data = path.join(repo, ".local-tools", "tesseract", "tessdata");
  if (!exists(executable)) return result;
  if (result.TESSERACT_PATH && result.TESSERACT_PATH !== executable) return result;
  result.TESSERACT_PATH ||= executable;
  if (exists(path.join(data, "eng.traineddata")) && exists(path.join(data, "hin.traineddata"))) {
    result.TESSDATA_PREFIX ||= data;
  }
  return result;
}

module.exports = { localOcrEnvironment };
