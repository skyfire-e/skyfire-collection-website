import { API } from './api.js';

export async function initSpreadsheetPage() {
  const container = document.getElementById('spreadsheetContainer');

  const sections = await API.get('/api/spreadsheet/public');
  if (!sections || sections.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px">No items yet</p>';
    return;
  }

  sections.forEach(section => {
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'ps-section';

    const sectionTitle = document.createElement('h2');
    sectionTitle.className = 'ps-section-title';
    sectionTitle.textContent = section.label;
    sectionDiv.appendChild(sectionTitle);

    section.subcategories.forEach(sub => {
      if (sub.items.length === 0) return;

      const subDiv = document.createElement('div');
      subDiv.className = 'ps-subcategory';

      const subTitle = document.createElement('h3');
      subTitle.className = 'ps-subcat-title';
      subTitle.textContent = sub.groupLabel ? sub.groupLabel + ' \u2192 ' + sub.label : sub.label;
      subDiv.appendChild(subTitle);

      const table = document.createElement('table');
      table.className = 'ps-table';

      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');

      const nameTh = document.createElement('th');
      nameTh.textContent = 'Name';
      headerRow.appendChild(nameTh);

      const authorTh = document.createElement('th');
      authorTh.textContent = 'Author / Origin';
      authorTh.style.width = '35%';
      headerRow.appendChild(authorTh);

      if (section.showColumns && section.showColumns.recaster) {
        const th = document.createElement('th');
        th.textContent = 'Recaster';
        headerRow.appendChild(th);
      }
      if (section.showColumns && section.showColumns.combatPoints) {
        const th = document.createElement('th');
        th.textContent = 'Command Points';
        headerRow.appendChild(th);
      }
      if (section.showColumns && section.showColumns.status) {
        const th = document.createElement('th');
        th.textContent = 'Status';
        headerRow.appendChild(th);
      }
      if (section.showPrices) {
        const th = document.createElement('th');
        th.className = 'ps-price-col';
        th.textContent = 'Price';
        th.style.width = '100px';
        headerRow.appendChild(th);
      }
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      sub.items.forEach(item => {
        const tr = document.createElement('tr');
        const td1 = document.createElement('td');
        td1.textContent = item.title;
        tr.appendChild(td1);
        const td2 = document.createElement('td');
        td2.textContent = item.author || '';
        td2.className = 'ps-author-col';
        tr.appendChild(td2);
        if (section.showColumns && section.showColumns.recaster) {
          const td = document.createElement('td');
          td.textContent = item.recaster || '';
          tr.appendChild(td);
        }
        if (section.showColumns && section.showColumns.combatPoints) {
          const td = document.createElement('td');
          td.textContent = item.combatPoints || '';
          tr.appendChild(td);
        }
        if (section.showColumns && section.showColumns.status) {
          const td = document.createElement('td');
          td.textContent = item.status || '';
          tr.appendChild(td);
        }
        if (section.showPrices) {
          const td3 = document.createElement('td');
          td3.className = 'ps-price-col';
          td3.textContent = item.price ? section.currency + ' ' + item.price : '';
          tr.appendChild(td3);
        }
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      subDiv.appendChild(table);

      const sumRow = document.createElement('div');
      sumRow.className = 'ps-subcat-sum';
      let sumText = sub.items.length + ' item' + (sub.items.length !== 1 ? 's' : '');
      if (section.showPrices && sub.sum > 0) {
        sumText += ', Sum: ' + section.currency + ' ' + sub.sum.toFixed(2);
      }
      sumRow.textContent = sumText;
      subDiv.appendChild(sumRow);

      subDiv.appendChild(document.createElement('hr'));
      sectionDiv.appendChild(subDiv);
    });

    if (section.showPrices && section.sum > 0) {
      const sectionSum = document.createElement('div');
      sectionSum.className = 'ps-section-sum';
      sectionSum.textContent = section.totalItems + ' items | Total for ' + section.label + ': ' + section.currency + ' ' + section.sum.toFixed(2);
      sectionDiv.appendChild(sectionSum);
    } else {
      const sectionSum = document.createElement('div');
      sectionSum.className = 'ps-section-sum';
      sectionSum.textContent = section.totalItems + ' items';
      sectionDiv.appendChild(sectionSum);
    }

    sectionDiv.appendChild(document.createElement('hr'));
    container.appendChild(sectionDiv);
  });
}

initSpreadsheetPage();
