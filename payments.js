// Importação de pagamentos previamente normalizados para uma planilha CSV.
function paymentRows(text, bills) {
  const [header, ...lines] = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  if (header !== 'competencia;unidade;valor;data') throw Error('Use o cabeçalho competencia;unidade;valor;data.');
  if (!lines.length) throw Error('O arquivo não contém pagamentos.');
  const seen = new Set();
  return lines.filter(line => line.trim()).map((line, index) => {
    const [month, unit, amount, date, extra] = line.split(';').map(value => value.trim());
    const bill = bills.find(item => item.month === month && item.unit === unit);
    const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
    const cents = Math.round(Number(amount?.replace(',', '.')) * 100);
    let problem = '';
    if (extra !== undefined || !dateValid || !/^\d+([.,]\d{1,2})?$/.test(amount)) problem = 'Formato inválido';
    else if (!bill) problem = 'Cobrança não localizada';
    else if (seen.has(bill.id)) problem = 'Cobrança duplicada no arquivo';
    else if (cents !== Math.round(bill.total * 100)) problem = 'Valor diverge da cobrança';
    else if (bill.paid) problem = 'Pagamento já registrado';
    if (bill) seen.add(bill.id);
    return {line: index + 2, month, unit, amount, date, bill, problem};
  });
}

const originalBills = bills;
bills = function () {
  originalBills();
  const button = document.createElement('button');
  button.textContent = 'Conferir pagamentos por CSV';
  button.className = 'no-print';
  button.onclick = paymentImport;
  app.querySelector('.top').append(button);
};

function paymentImport() {
  const originalDb = db;
  modal.innerHTML = `<h2>Conferir pagamentos · ${esc(condoName())}</h2>
    <p>Use um CSV separado por ponto e vírgula, com uma linha por pagamento integral.
    Cabeçalho: <code>competencia;unidade;valor;data</code>. Exemplo:
    <code>2026-11;101;487,32;2026-11-10</code>. Arquivos CNAB precisam de conversão.</p>
    <label>Arquivo CSV<input type="file" accept=".csv,text/csv"></label>
    <p role="status"></p><div class="scroll"></div>
    <div class="row"><button id="applyPayments" disabled>Confirmar pagamentos</button>
    <button onclick="modal.close()">Fechar</button></div>`;
  const input = modal.querySelector('input');
  const confirm = modal.querySelector('#applyPayments');
  const status = modal.querySelector('[role=status]');
  const preview = modal.querySelector('.scroll');
  input.onchange = async () => {
    confirm.disabled = true;
    confirm.onclick = null;
    preview.replaceChildren();
    status.textContent = '';
    const file = input.files[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw Error('O CSV deve ter até 2 MB.');
      const text = await file.text();
      if (input.files[0] !== file) return;
      const rows = paymentRows(text, originalDb.bills);
      const ready = rows.filter(row => !row.problem);
      status.textContent = ready.length + ' prontos para registrar · ' + (rows.length - ready.length) + ' não serão alterados';
      preview.innerHTML = '<table><tr><th>Linha</th><th>Competência</th><th>Unidade</th><th>Situação</th></tr>' +
        rows.map(row => '<tr><td>' + row.line + '</td><td>' + esc(row.month) + '</td><td>' +
          esc(row.unit) + '</td><td>' + esc(row.problem || 'Pronto') + '</td></tr>').join('') + '</table>';
      confirm.disabled = ready.length === 0;
      confirm.onclick = async () => {
        if (db !== originalDb || ready.some(row => row.bill.paid || !db.bills.includes(row.bill))) {
          status.textContent = 'As cobranças mudaram. Abra a conferência novamente.';
          confirm.disabled = true;
          return;
        }
        confirm.disabled = true;
        input.disabled = true;
        const prior = ready.map(({bill}) => ({paid: bill.paid, paymentDate: bill.paymentDate}));
        ready.forEach(({bill, date}) => Object.assign(bill, {paid: true, paymentDate: date}));
        try {
          await persistDb();
          if (modal.open) modal.close();
          render();
        } catch {
          ready.forEach(({bill}, index) => Object.assign(bill, prior[index]));
          status.textContent = 'Não foi possível gravar os pagamentos.';
          confirm.disabled = false;
          input.disabled = false;
        }
      };
    } catch (error) {
      status.textContent = error.message;
    }
  };
  modal.showModal();
}
