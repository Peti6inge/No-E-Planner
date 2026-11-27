function onFormSubmitTrigger(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetCible = ss.getSheetByName('PLANNING');

  var namedValues = e.namedValues;

  var statut = namedValues['Statut'] ? namedValues['Statut'][0] : '1 - TODO';
  var module = namedValues['Module'] ? namedValues['Module'][0] : 'OTHER';
  var duration = namedValues['Duration'] ? namedValues['Duration'][0] : 'MEDIUM';
  var tache = namedValues['Tâche'] ? namedValues['Tâche'][0] : '';

  var nextId = 1;
  var lastRowCible = sheetCible.getLastRow();

  if (lastRowCible > 1) {
    var idValues = sheetCible.getRange(2, 1, lastRowCible - 1, 1).getValues();
    var idSet = {};
    for (var i = 0; i < idValues.length; i++) {
      var val = parseInt(idValues[i][0], 10);
      if (!isNaN(val)) {
        idSet[val] = true;
      }
    }
    while (idSet[nextId]) {
      nextId++;
    }
  }

  var nouvelleLigne = [nextId, statut, module, duration, tache];
  sheetCible.appendRow(nouvelleLigne);
}

/**
 * Bridge Sheets pour No-E-Planner (PLANNING, BRAINSTORM, NOTES, images Drive).
 *
 * Déploiement (une fois) :
 * 1. Ouvre le classeur PLANNING → Extensions → Apps Script
 * 2. Colle ce fichier (remplace Code.gs) et apps-script/appsscript.json
 *    (scopes Drive + Sheets, sinon DriveApp.getFileById est refusé)
 * 3. Dans l’éditeur : choisir authorizeDriveForNotes → Exécuter → accepter Drive
 *    (compte = celui du déploiement). Sinon le Web App garde l’ancien jeton.
 * 4. Déployer → Nouveau déploiement → Type : Application Web
 *    - Exécuter en tant que : Moi
 *    - Qui peut y accéder : Tout le monde
 * 5. Copie l’URL /exec dans VITE_SHEETS_BRIDGE_URL (.env.local + secret GitHub)
 *
 * Après chaque modification du script : Déployer → Gérer les déploiements → ✎ → Nouvelle version.
 * Après un scope Drive ajouté : relancer authorizeDriveForNotes, puis une nouvelle version.
 */

var SPREADSHEET_ID = '1yLNRF8ylX5qUdvpPVgzmtucmd1AISJ18rfOhEfbo0Ak';
var PLANNING_TITLES = ['PLANNING', 'Planning', 'planning'];
var BRAINSTORM_TITLES = ['BRAINSTORM', 'Brainstorm', 'brainstorm'];
var NOTES_TITLES = ['NOTES', 'Notes', 'notes'];
var NOTES_CELL_MAX = 50000;
var NOTES_IMAGES_FOLDER = 'NOTES-IMAGES';
var NOTES_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || 'ping';
    var result = dispatch(action, e && e.parameter ? e.parameter : {});
    return jsonOut(result);
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var body = JSON.parse(raw);
    var action = body.action || 'ping';
    var result = dispatch(action, body);
    return jsonOut(result);
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function dispatch(action, payload) {
  switch (action) {
    case 'ping':
      return { ok: true, service: 'no-e-planner-bridge' };
    case 'getPlanning':
      return { ok: true, values: getPlanningValues_() };
    case 'updateTicket':
      updateTicket_(payload.sheetRow, payload.values);
      return { ok: true };
    case 'appendTicket':
      return { ok: true, sheetRow: appendTicket_(payload.values) };
    case 'deleteTicket':
      deleteTicket_(payload.sheetRow);
      return { ok: true };
    case 'getBrainstorm':
      return { ok: true, values: getBrainstormValues_() };
    case 'replaceBrainstorm':
      replaceBrainstorm_(payload.values || []);
      return { ok: true };
    case 'getNotes':
      var notesPayload = getNotesValues_();
      return { ok: true, values: notesPayload.values, missing: notesPayload.missing };
    case 'replaceNotes':
      replaceNotes_(payload.values || []);
      return { ok: true };
    case 'uploadNoteImage':
      return uploadNoteImage_(payload);
    case 'getNoteImage':
      return getNoteImage_(payload);
    default:
      throw new Error('Action inconnue : ' + action);
  }
}

function ss_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function findSheet_(titles) {
  var spreadsheet = ss_();
  for (var i = 0; i < titles.length; i++) {
    var sheet = spreadsheet.getSheetByName(titles[i]);
    if (sheet) return sheet;
  }
  throw new Error('Onglet introuvable : ' + titles.join(' / '));
}

function planningSheet_() {
  return findSheet_(PLANNING_TITLES);
}

function brainstormSheet_() {
  return findSheet_(BRAINSTORM_TITLES);
}

function getPlanningValues_() {
  var sheet = planningSheet_();
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var lastCol = Math.max(sheet.getLastColumn(), 7);
  return sheet.getRange(1, 1, lastRow, Math.min(lastCol, 7)).getDisplayValues();
}

function updateTicket_(sheetRow, values) {
  if (!isInt_(sheetRow) || sheetRow < 2) {
    throw new Error('Numéro de ligne invalide pour updateTicket.');
  }
  if (!values || values.length < 7) {
    throw new Error('values doit contenir 7 colonnes (A–G).');
  }
  planningSheet_().getRange(sheetRow, 1, 1, 7).setValues([values.slice(0, 7)]);
}

function appendTicket_(values) {
  if (!values || values.length < 7) {
    throw new Error('values doit contenir 7 colonnes (A–G).');
  }
  var sheet = planningSheet_();
  sheet.appendRow(values.slice(0, 7));
  return sheet.getLastRow();
}

function deleteTicket_(sheetRow) {
  if (!isInt_(sheetRow) || sheetRow < 2) {
    throw new Error('Numéro de ligne invalide pour deleteTicket.');
  }
  planningSheet_().deleteRow(sheetRow);
}

function getBrainstormValues_() {
  var sheet = brainstormSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 1) return [];
  var lastCol = Math.max(sheet.getLastColumn(), 3);
  return sheet.getRange(1, 1, lastRow, Math.min(lastCol, 3)).getDisplayValues();
}

function replaceBrainstorm_(values) {
  var sheet = brainstormSheet_();
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var lastCol = Math.max(sheet.getLastColumn(), 3);
  sheet.getRange(1, 1, lastRow, lastCol).clearContent();
  if (!values || !values.length) return;
  sheet.getRange(1, 1, values.length, 3).setValues(
    values.map(function (row) {
      return [row[0], row[1], row[2]];
    }),
  );
}

function notesSheet_(create) {
  var spreadsheet = ss_();
  for (var i = 0; i < NOTES_TITLES.length; i++) {
    var sheet = spreadsheet.getSheetByName(NOTES_TITLES[i]);
    if (sheet) return sheet;
  }
  if (!create) return null;
  return spreadsheet.insertSheet('NOTES');
}

function getNotesValues_() {
  var sheet = notesSheet_(false);
  if (!sheet) return { values: [], missing: true };
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return { values: [], missing: false };
  return {
    values: sheet.getRange(1, 1, lastRow, lastCol).getValues(),
    missing: false,
  };
}

function replaceNotes_(values) {
  if (!values || !values.length) values = [];
  if (!Array.isArray(values)) {
    throw new Error('values doit être un tableau de lignes.');
  }

  var maxCol = 1;
  var rect = [];
  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    if (!Array.isArray(row)) {
      throw new Error('Chaque ligne de notes doit être un tableau.');
    }
    if (row.length > maxCol) maxCol = row.length;
    var copy = [];
    for (var c = 0; c < row.length; c++) {
      var cell = row[c] == null ? '' : String(row[c]);
      if (cell.length > NOTES_CELL_MAX) {
        throw new Error('Une cellule de notes dépasse ' + NOTES_CELL_MAX + ' caractères.');
      }
      copy.push(cell);
    }
    rect.push(copy);
  }
  for (var i = 0; i < rect.length; i++) {
    while (rect[i].length < maxCol) rect[i].push('');
  }

  var sheet = notesSheet_(true);
  if (sheet.getMaxColumns() < maxCol) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), maxCol - sheet.getMaxColumns());
  }
  var neededRows = Math.max(rect.length, 1);
  if (sheet.getMaxRows() < neededRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), neededRows - sheet.getMaxRows());
  }

  var clearRows = Math.max(sheet.getLastRow(), rect.length, 1);
  var clearCols = Math.max(sheet.getLastColumn(), maxCol, 1);
  sheet.getRange(1, 1, clearRows, clearCols).clearContent();
  if (!rect.length) return;

  // Format texte : un « = » ou une URL reste du texte, pas une formule.
  var writeRange = sheet.getRange(1, 1, rect.length, maxCol);
  writeRange.setNumberFormat('@');
  writeRange.setValues(rect);
}

function notesImagesFolder_(create) {
  var props = PropertiesService.getScriptProperties();
  var stored = props.getProperty('NOTES_IMAGES_FOLDER_ID');
  if (stored) {
    try {
      var existing = DriveApp.getFolderById(stored);
      if (!existing.isTrashed()) return existing;
    } catch (err) {
      // identifiant périmé : on cherche ou on recrée le dossier
    }
  }

  var ssFile = DriveApp.getFileById(SPREADSHEET_ID);
  var parents = ssFile.getParents();
  var parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  var found = parent.getFoldersByName(NOTES_IMAGES_FOLDER);
  if (found.hasNext()) {
    var folder = found.next();
    props.setProperty('NOTES_IMAGES_FOLDER_ID', folder.getId());
    return folder;
  }
  if (!create) return null;
  var created = parent.createFolder(NOTES_IMAGES_FOLDER);
  props.setProperty('NOTES_IMAGES_FOLDER_ID', created.getId());
  return created;
}

/**
 * À lancer une fois dans l’éditeur, avec le compte qui déploie le Web App,
 * après avoir ajouté le scope Drive. Le consentement OAuth se fait ici :
 * une nouvelle version seule ne rafraîchit pas le jeton.
 * Crée puis met à la corbeille un fichier test dans NOTES-IMAGES.
 * Ensuite seulement : Déployer → Gérer les déploiements → nouvelle version.
 */
function authorizeDriveForNotes() {
  var folder = notesImagesFolder_(true);
  var blob = Utilities.newBlob(
    'Test d’autorisation Drive. Ce fichier est mis à la corbeille tout de suite.',
    'text/plain',
    'authorize-drive-test.txt'
  );
  var file = folder.createFile(blob);
  file.setTrashed(true);
  Logger.log('Drive autorisé. Dossier ' + folder.getName() + ' : ' + folder.getId());
}

function fileInFolder_(file, folder) {
  var parents = file.getParents();
  var folderId = folder.getId();
  while (parents.hasNext()) {
    if (parents.next().getId() === folderId) return true;
  }
  return false;
}

function imageMime_(mime) {
  var normalized = String(mime || '').toLowerCase().split(';')[0].trim();
  if (normalized === 'image/jpg') normalized = 'image/jpeg';
  var extensions = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
  };
  var ext = extensions[normalized];
  if (!ext) return null;
  return { mime: normalized, ext: ext };
}

function uploadNoteImage_(payload) {
  var spec = imageMime_(payload && payload.mimeType);
  if (!spec) {
    throw new Error('Format d’image non accepté (png, jpeg, gif, webp, bmp).');
  }
  var dataBase64 = payload && payload.dataBase64 ? String(payload.dataBase64).replace(/\s+/g, '') : '';
  if (!dataBase64) throw new Error('Image vide.');
  if (dataBase64.length > 12000000) {
    throw new Error('Image trop lourde (8 Mo maximum).');
  }

  var bytes;
  try {
    bytes = Utilities.base64Decode(dataBase64);
  } catch (err) {
    throw new Error('Image illisible.');
  }
  if (!bytes || bytes.length > NOTES_IMAGE_MAX_BYTES) {
    throw new Error('Image trop lourde (8 Mo maximum).');
  }

  var folder = notesImagesFolder_(true);
  var blob = Utilities.newBlob(bytes, spec.mime, 'note-' + new Date().getTime() + '.' + spec.ext);
  var file = folder.createFile(blob);
  return { ok: true, fileId: file.getId() };
}

function getNoteImage_(payload) {
  var fileId = payload && payload.fileId ? String(payload.fileId) : '';
  if (!/^[A-Za-z0-9_-]+$/.test(fileId)) {
    throw new Error('Identifiant d’image invalide.');
  }
  var folder = notesImagesFolder_(false);
  if (!folder) throw new Error('Image introuvable.');
  var file;
  try {
    file = DriveApp.getFileById(fileId);
  } catch (err) {
    throw new Error('Image introuvable.');
  }
  if (file.isTrashed() || !fileInFolder_(file, folder)) {
    throw new Error('Image introuvable.');
  }
  var blob = file.getBlob();
  return {
    ok: true,
    mimeType: blob.getContentType() || 'application/octet-stream',
    dataBase64: Utilities.base64Encode(blob.getBytes()),
  };
}

function isInt_(n) {
  return typeof n === 'number' && isFinite(n) && Math.floor(n) === n;
}