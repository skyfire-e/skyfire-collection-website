import { API } from './api.js';

function exportCSV() {
  API.get('/api/spreadsheet/public').then(sections => {
    let csv = 'Section,Category,Title,Author,Price,Recaster,Command Points,Status\n';
    for (const sec of sections) {
      for (const sub of sec.subcategories) {
        for (const item of sub.items) {
          const row = [
            sec.label, sub.groupLabel ? sub.groupLabel + ' - ' + sub.label : sub.label,
            item.title || '', item.author || '', item.price || '',
            item.recaster || '', item.combatPoints || '', item.status || ''
          ].map(f => '"' + String(f).replace(/"/g, '""') + '"').join(',');
          csv += row + '\n';
        }
      }
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'skyfire-collection.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

function toggleCategory(header) {
  const content = header.nextElementSibling;
  const isCollapsed = content.classList.contains('collapsed');
  if (isCollapsed) {
    content.classList.remove('collapsed');
    header.querySelector('.cat-toggle').textContent = '▼';
  } else {
    content.classList.add('collapsed');
    header.querySelector('.cat-toggle').textContent = '▶';
  }
}

export async function initSpreadsheetPage() {
  const container = document.getElementById('spreadsheetContainer');
  container.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';

  try {
    const sections = await API.get('/api/spreadsheet/public');
    if (!sections || sections.length === 0) {
      container.innerHTML = '<p class="empty-state">No items yet</p>';
      return;
    }
    container.innerHTML = '';

    sections.forEach(section => {
      const sectionDiv = document.createElement('div');
      sectionDiv.className = 'ps-section';

      const sectionHeader = document.createElement('div');
      sectionHeader.className = 'ps-cat-header ps-section-header';

      const sectionToggle = document.createElement('span');
      sectionToggle.className = 'cat-toggle';
      sectionToggle.textContent = '▶';
      sectionHeader.appendChild(sectionToggle);

      const sectionTitle = document.createElement('h2');
      sectionTitle.className = 'ps-section-title';
      sectionTitle.textContent = section.label;
      sectionHeader.appendChild(sectionTitle);

      const sectionInfo = document.createElement('span');
      sectionInfo.className = 'ps-cat-info';
      let infoText = section.totalItems + ' items';
      if (section.showPrices && section.sum > 0) {
        infoText += ' | ' + section.currency + ' ' + section.sum.toFixed(2);
      }
      sectionInfo.textContent = infoText;
      sectionHeader.appendChild(sectionInfo);

      sectionDiv.appendChild(sectionHeader);

      const sectionContent = document.createElement('div');
      sectionContent.className = 'ps-cat-content collapsed';

      sectionHeader.addEventListener('click', () => toggleCategory(sectionHeader));

      section.subcategories.forEach(sub => {
        if (sub.items.length === 0) return;

        const subHeader = document.createElement('div');
        subHeader.className = 'ps-cat-header ps-subcat-header';

        const subToggle = document.createElement('span');
        subToggle.className = 'cat-toggle';
        subToggle.textContent = '▶';
        subHeader.appendChild(subToggle);

        const subTitle = document.createElement('h3');
        subTitle.className = 'ps-subcat-title';
        subTitle.textContent = sub.groupLabel ? sub.groupLabel + ' → ' + sub.label : sub.label;
        subHeader.appendChild(subTitle);

        const subInfo = document.createElement('span');
        subInfo.className = 'ps-cat-info';
        let subInfoText = sub.items.length + ' items';
        if (section.showPrices && sub.sum > 0) {
          subInfoText += ' | ' + section.currency + ' ' + sub.sum.toFixed(2);
        }
        subInfo.textContent = subInfoText;
        subHeader.appendChild(subInfo);

        sectionContent.appendChild(subHeader);

        const subContent = document.createElement('div');
        subContent.className = 'ps-cat-content collapsed';

        subHeader.addEventListener('click', () => toggleCategory(subHeader));

        const table = document.createElement('table');
        table.className = 'ps-table';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        const nameTh = document.createElement('th');
        nameTh.textContent = 'Name';
        headerRow.appendChild(nameTh);

        const authorTh = document.createElement('th');
        authorTh.textContent = 'Author / Origin';
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
        subContent.appendChild(table);
        sectionContent.appendChild(subContent);
      });

      sectionDiv.appendChild(sectionContent);
      sectionDiv.appendChild(document.createElement('hr'));
      container.appendChild(sectionDiv);
    });
  } catch (err) {
    container.innerHTML = '<p class="empty-state">Failed to load spreadsheet. Please try again.</p>';
  }
}

initSpreadsheetPage();

const csvBtn = document.getElementById('csvBtn');
if (csvBtn) csvBtn.addEventListener('click', exportCSV);
