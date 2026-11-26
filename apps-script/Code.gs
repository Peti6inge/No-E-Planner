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
 * Bridge Sheets pour No-E-Planner.
 *
 * Déploiement (une fois) :
 * 1. Ouvre le classeur PLANNING → Extensions → Apps Script
 * 2. Colle ce fichier (remplace Code.gs)
 * 3. Déployer → Nouveau déploiement → Type : Application Web
 *    - Exécuter en tant que : Moi
 *    - Qui peut y accéder : Tout le monde
 * 4. Copie l’URL /exec dans VITE_SHEETS_BRIDGE_URL (.env.local + secret GitHub)
 *
 * Après chaque modification du script : Déployer → Gérer les déploiements → ✎ → Nouvelle version.
 */

var SPREADSHEET_ID = '1yLNRF8ylX5qUdvpPVgzmtucmd1AISJ18rfOhEfbo0Ak';
var PLANNING_TITLES = ['PLANNING', 'Planning', 'planning'];
var BRAINSTORM_TITLES = ['BRAINSTORM', 'Brainstorm', 'brainstorm'];

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

function isInt_(n) {
  return typeof n === 'number' && isFinite(n) && Math.floor(n) === n;
}