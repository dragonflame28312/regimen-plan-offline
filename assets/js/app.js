/*
 * Regimen Plan application script
 * Loads data from master_plan.json, builds UI components
 */
(function () {
  const state = {
    data: [],
    items: [],
    itemIndex: {},
    byDate: {},
    currentTimeFilter: 'all',
    currentTypeFilter: 'all',
    currentMonth: new Date(),
  };

  // Utility to split comma-separated values into trimmed array
  function splitList(str) {
    if (!str) return [];
    return str.split(',').map(s => s.trim()).filter(s => s);
  }

  // Load data from JSON
  async function loadData() {
    try {
      const res = await fetch('master_plan.json');
      state.data = await res.json();
      processData();
      buildCarousel();
      buildCalendar();
      buildScheduleTable();
      attachEventHandlers();
    } catch (err) {
      console.error('Error loading data:', err);
    }
  }

  // Process raw data into byDate and item index
  function processData() {
    state.byDate = {};
    state.itemIndex = {};
    state.data.forEach(row => {
      const dateStr = row.date;
      const time = row.time;
      const period = row.period || '';
      if (!state.byDate[dateStr]) {
        state.byDate[dateStr] = { morning: { sup: [], hair: [], skin: [] }, midday: { sup: [], hair: [], skin: [] }, night: { sup: [], hair: [], skin: [] } };
      }
      // categorize items
      ['supplements','hair_care','skin_care'].forEach(field => {
        const list = splitList(row[field]);
        list.forEach(item => {
          const type = field === 'supplements' ? 'supplement' : (field === 'hair_care' ? 'hair' : 'skin');
          // update byDate
          state.byDate[dateStr][period][type === 'supplement' ? 'sup' : type] = state.byDate[dateStr][period][type === 'supplement' ? 'sup' : type].concat(item);
          // update item index
          const nameKey = item.toLowerCase();
          if (!state.itemIndex[nameKey]) {
            state.itemIndex[nameKey] = { name: item, type: type, periods: new Set(), dates: [] };
          }
          state.itemIndex[nameKey].periods.add(period);
          state.itemIndex[nameKey].dates.push(dateStr + ' ' + time);
        });
      });
    });
    // convert itemIndex to array
    state.items = Object.values(state.itemIndex).map(it => {
      return { name: it.name, type: it.type, periods: Array.from(it.periods) };
    });
  }

  // Build the carousel of item cards
  function buildCarousel() {
    const carousel = document.getElementById('carousel');
    carousel.innerHTML = '';
    state.items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.type = item.type;
      card.dataset.periods = item.periods.join(',');
      const nameEl = document.createElement('h3');
      nameEl.textContent = item.name;
      const badges = document.createElement('div');
      badges.className = 'badges';
      // type badge
      const typeBadge = document.createElement('span');
      typeBadge.className = 'badge';
      typeBadge.textContent = item.type.charAt(0).toUpperCase() + item.type.slice(1);
      badges.appendChild(typeBadge);
      // period badges
      item.periods.forEach(p => {
        const pb = document.createElement('span');
        pb.className = 'badge';
        pb.textContent = p.charAt(0).toUpperCase() + p.slice(1);
        badges.appendChild(pb);
      });
      const details = document.createElement('div');
      details.className = 'details';
      details.textContent = 'Occurs on ' + state.itemIndex[item.name.toLowerCase()].dates.length + ' occasions';
      const toggle = document.createElement('div');
      toggle.className = 'toggle';
      toggle.textContent = '+ details';
      toggle.addEventListener('click', () => {
        const expanded = card.classList.toggle('expanded');
        toggle.textContent = expanded ? '− hide' : '+ details';
      });
      card.appendChild(nameEl);
      card.appendChild(badges);
      card.appendChild(details);
      card.appendChild(toggle);
      carousel.appendChild(card);
    });
    applyFilters();
  }

  // Apply filters to carousel
  function applyFilters() {
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
      const type = card.dataset.type;
      const periods = card.dataset.periods.split(',');
      const typeMatch = state.currentTypeFilter === 'all' || state.currentTypeFilter === type;
      const timeMatch = state.currentTimeFilter === 'all' || (state.currentTimeFilter === 'daily' ? periods.length === 3 : periods.includes(state.currentTimeFilter));
      if (typeMatch && timeMatch) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  }

  // Build calendar grid for current month
  function buildCalendar() {
    const monthDisplay = document.getElementById('calendar-month');
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    const year = state.currentMonth.getFullYear();
    const month = state.currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = state.currentMonth.toLocaleString('default', { month: 'long' });
    monthDisplay.textContent = monthName + ' ' + year;
    // Weekday headers
    const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    weekdays.forEach(day => {
      const header = document.createElement('div');
      header.className = 'day header';
      header.textContent = day;
      grid.appendChild(header);
    });
    // Fill blank cells before first day
    for (let i=0; i<startDay; i++) {
      const blank = document.createElement('div');
      blank.className = 'day blank';
      grid.appendChild(blank);
    }
    // Create day cells
    for (let d=1; d<=daysInMonth; d++) {
      const dateStr = new Date(year, month, d).toISOString().split('T')[0];
      const cell = document.createElement('div');
      cell.className = 'day';
      cell.dataset.date = dateStr;
      const number = document.createElement('div');
      number.className = 'day-number';
      number.textContent = d;
      cell.appendChild(number);
      // dots
      const dots = document.createElement('div');
      dots.className = 'dots';
      if (state.byDate[dateStr]) {
        ['morning','midday','night'].forEach(p => {
          const slot = state.byDate[dateStr][p];
          const hasItems = slot.sup.length || slot.hair.length || slot.skin.length;
          if (hasItems) {
            const dot = document.createElement('span');
            dot.className = 'dot ' + p;
            dots.appendChild(dot);
          }
        });
      }
      cell.appendChild(dots);
      cell.addEventListener('click', () => showDayDetails(dateStr));
      grid.appendChild(cell);
    }
  }

  // Show details for a selected date
  function showDayDetails(dateStr) {
    const detailsPanel = document.getElementById('day-details');
    const detailsDate = document.getElementById('details-date');
    const detailsContent = document.getElementById('details-content');
    detailsPanel.classList.remove('hidden');
    detailsDate.textContent = dateStr;
    detailsContent.innerHTML = '';
    const dayData = state.byDate[dateStr];
    if (!dayData) {
      detailsContent.textContent = 'No entries.';
      return;
    }
    ['morning','midday','night'].forEach(p => {
      const slot = dayData[p];
      const has = slot.sup.length || slot.hair.length || slot.skin.length;
      const slotDiv = document.createElement('div');
      slotDiv.className = 'slot';
      const title = document.createElement('h4');
      title.textContent = p.charAt(0).toUpperCase() + p.slice(1);
      slotDiv.appendChild(title);
      if (!has) {
        const none = document.createElement('p');
        none.textContent = '—';
        slotDiv.appendChild(none);
      } else {
        const list = document.createElement('ul');
        ['sup','hair','skin'].forEach(cat => {
          slot[cat].forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            list.appendChild(li);
          });
        });
        slotDiv.appendChild(list);
      }
      detailsContent.appendChild(slotDiv);
    });
  }

  // Build full schedule table
  function buildScheduleTable() {
    const container = document.getElementById('schedule-table-container');
    container.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'schedule-table';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Date','Time','Category','Item'].forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    state.data.forEach(row => {
      ['supplements','hair_care','skin_care'].forEach((field, idx) => {
        const list = splitList(row[field]);
        const category = field === 'supplements' ? 'Supplement' : (field === 'hair_care' ? 'Hair' : 'Skin');
        list.forEach(item => {
          const tr = document.createElement('tr');
          const cells = [row.date, row.time, category, item];
          cells.forEach(val => {
            const td = document.createElement('td');
            td.textContent = val;
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
      });
    });
    table.appendChild(tbody);
    container.appendChild(table);
    // search handler
    const searchInput = document.getElementById('search-schedule');
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase();
      Array.from(tbody.children).forEach(tr => {
        const text = tr.textContent.toLowerCase();
        tr.style.display = text.includes(query) ? '' : 'none';
      });
    });
  }

  // Attach event listeners to filters and buttons
  function attachEventHandlers() {
    // time filters
    document.querySelectorAll('#time-filters .filter-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#time-filters .filter-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentTimeFilter = btn.dataset.time;
        applyFilters();
      });
    });
    // type filters
    document.querySelectorAll('#type-filters .filter-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#type-filters .filter-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentTypeFilter = btn.dataset.type;
        applyFilters();
      });
    });
    // calendar button
    document.getElementById('calendar-btn').addEventListener('click', () => {
      document.getElementById('calendar-modal').classList.remove('hidden');
    });
    // full schedule button
    document.getElementById('fullschedule-btn').addEventListener('click', () => {
      document.getElementById('schedule-modal').classList.remove('hidden');
    });
    // close modals
    document.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.modal;
        document.getElementById(modalId).classList.add('hidden');
      });
    });
    // navigate months
    document.getElementById('prev-month').addEventListener('click', () => {
      state.currentMonth.setMonth(state.currentMonth.getMonth() - 1);
      buildCalendar();
    });
    document.getElementById('next-month').addEventListener('click', () => {
      state.currentMonth.setMonth(state.currentMonth.getMonth() + 1);
      buildCalendar();
    });
  }

  // Start
  loadData();
})();
