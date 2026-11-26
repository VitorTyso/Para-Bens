// Registro de notas autorizadas e sua associação às cobranças do condomínio.
const fiscalNotes = () => db.fiscalNotes || [];
const noteLabel = note => 'NFS-e ' + note.number + ' · ' + periodLabel(note.month);

function fiscalLinks(note) {
  return ['xml', 'pdf'].filter(type => note[type]).map(type =>
    '<button type="button" onclick="downloadFiscal(\'' + note.key + '\',\'' + type + '\')">' +
    (type === 'xml' ? 'Baixar XML' : 'Baixar DANFSe') + '</button>'
  ).join(' ');
}

function downloadFiscal(key, type) {
  const file = fiscalNotes().find(note => note.key === key)?.[type];
  if (!file) return;
  const url = URL.createObjectURL(new Blob([type === 'pdf' ? Uint8Array.from(file.bytes) : file.text], {type: 'application/octet-stream'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'nfse-' + key + '.' + type;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const originalDocuments = condoDocuments;
condoDocuments = function () {
  originalDocuments();
  const section = document.createElement('section');
  section.innerHTML = '<div class="row"><h3>Notas fiscais do condomínio</h3>' +
    '<button onclick="fiscalForm()">Registrar nota</button></div>' +
    (fiscalNotes().map(note => '<p><strong>' + esc(noteLabel(note)) + '</strong><br>' +
      esc(note.units.join(', ')) + ' · ' + esc(note.key) + '</p><div class="row">' +
      fiscalLinks(note) + '</div>').join('') || '<p>Nenhuma nota registrada.</p>');
  modal.insertBefore(section, modal.lastElementChild);
};

function fiscalForm() {
  modal.innerHTML = `<h2>Registrar NFS-e autorizada</h2><p>${esc(condoName())}</p>
    <form id="fiscalForm">
      <label>Número da nota<input name="number" required maxlength="30"></label>
      <label>Chave de acesso<input name="key" inputmode="numeric" pattern="[0-9]{50}" title="Informe os 50 dígitos" required></label>
      <label>Competência<select name="month" required>${[...new Set(db.bills.map(b => b.month))].sort().reverse().map(month =>
        '<option value="' + esc(month) + '">' + esc(periodLabel(month)) + '</option>').join('')}</select></label>
      <label>Unidades vinculadas<select name="units" multiple size="5" required></select></label>
      <label>XML autorizado<input name="xml" type="file" accept=".xml" required></label>
      <label>DANFSe em PDF<input name="pdf" type="file" accept=".pdf"></label>
      <div class="row"><button>Salvar nota</button><button type="button" onclick="condoDocuments()">Voltar</button></div>
      <p role="status" id="fiscalStatus"></p>
    </form>`;
  const form = modal.querySelector('form');
  const updateUnits = () => {
    form.elements.units.replaceChildren(...db.bills.filter(bill => bill.month === form.elements.month.value)
      .map(bill => new Option('Unidade ' + bill.unit, bill.unit)));
  };
  updateUnits();
  form.elements.month.onchange = updateUnits;
  form.onsubmit = saveFiscalNote;
}

async function saveFiscalNote(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = form.querySelector('[role=status]');
  const submit = form.querySelector('button');
  const data = new FormData(form);
  const key = data.get('key');
  const month = data.get('month');
  const units = [...new Set(data.getAll('units'))];
  const xml = data.get('xml');
  const pdf = data.get('pdf');
  const currentDb = db;
  const prior = db.fiscalNotes;
  submit.disabled = true;
  try {
    if (fiscalNotes().some(note => note.key === key)) throw Error('Esta chave já está registrada.');
    if (!units.length || units.some(unit => !db.bills.some(bill => bill.unit === unit && bill.month === month))) {
      throw Error('Selecione as unidades da competência.');
    }
    if (xml.size > 5_000_000 || pdf.size > 10_000_000) throw Error('Limites de arquivo: XML 5 MB, PDF 10 MB.');
    const xmlText = await xml.text();
    const parsed = new DOMParser().parseFromString(xmlText, 'application/xml');
    const info = [...parsed.getElementsByTagNameNS('*', 'infNFSe')].find(node => node.getAttribute('Id') === 'NFS' + key);
    if (parsed.querySelector('parsererror') || !info) throw Error('O XML deve ser de uma NFS-e com a chave informada.');
    const pdfBytes = pdf.size ? await pdf.arrayBuffer() : null;
    if (pdfBytes && new TextDecoder().decode(pdfBytes.slice(0, 5)) !== '%PDF-') throw Error('O DANFSe deve estar em PDF.');
    if (db !== currentDb) throw Error('O condomínio mudou durante o registro.');
    db.fiscalNotes = [...fiscalNotes(), {key, number: data.get('number').trim(), month, units,
      xml: {text: xmlText}, pdf: pdfBytes ? {bytes: Array.from(new Uint8Array(pdfBytes))} : null}];
    try {
      await persistDb();
    } catch (error) {
      currentDb.fiscalNotes = prior;
      throw Error('Não foi possível gravar a nota.');
    }
    if (modal.open) condoDocuments();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
}

const originalBillHistory = billHistory;
billHistory = function (id) {
  originalBillHistory(id);
  const bill = db.bills.find(item => item.id === id);
  const notes = fiscalNotes().filter(note => note.month === bill.month && note.units.includes(bill.unit));
  const section = document.createElement('section');
  section.innerHTML = '<h3>Nota fiscal</h3>' + (notes.map(note =>
    '<p>' + esc(noteLabel(note)) + '</p><div class="row">' + fiscalLinks(note) + '</div>'
  ).join('') || '<p>Nenhuma nota vinculada a esta cobrança.</p>');
  modal.append(section);
};
