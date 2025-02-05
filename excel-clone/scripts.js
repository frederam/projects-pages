const $ = (el) => document.querySelector(el);
const $$ = (el) => document.querySelectorAll(el);

const $table = $("table");
const $thead = $("thead");
const $tbody = $("tbody");

const ROWS = 10;
const COLUMNS = 20;
const FIRST_CHAR_CODE = 65;

const range = (length) => Array.from({ length }, (_, i) => i);
const getColumnLetter = (i) => String.fromCharCode(i + FIRST_CHAR_CODE);

let dependencies = {};
let dependents = {};

let STATE = range(COLUMNS).map((i) => range(ROWS).map((j) => ({ computedValue: 0, value: 0 })));

function updateCell({ x, y, value }) {
  const newState = structuredClone(STATE);
  
  const cell = newState[x][y];
  cell.value = value;
  
  computeAllCells(newState);
  STATE = newState;

  updateDependentCells(x, y);

  renderSpreadSheet();
}


function computeAllCells(cells) {
  dependencies = {};
  dependents = {};

  cells.forEach((rows, x) => {
    rows.forEach((cell, y) => {
      cell.computedValue = computeValue(cell.value, x, y);
    });
  });
}

function computeValue(value, x, y) {
  if (typeof value === "number") return value;
  if (!value.startsWith("=")) return value;

  const formula = value.slice(1).toUpperCase();

  const key = `${x},${y}`;
  dependencies[key] = new Set();

  try {
    const formulaWithValues = formula.replace(/([A-Z]+)(\d+)/g, (match, colLetter, rowNum) => {
      const colIndex = colLetter.charCodeAt(0) - FIRST_CHAR_CODE;
      const rowIndex = parseInt(rowNum, 10) - 1;

      if (colIndex < 0 || colIndex >= COLUMNS || rowIndex < 0 || rowIndex >= ROWS) {
        throw new Error(`Invalid reference: ${match}`);
      }

      dependencies[key].add(`${colIndex},${rowIndex}`);

      const refKey = `${colIndex},${rowIndex}`;
      if (!dependents[refKey]) dependents[refKey] = new Set();
      dependents[refKey].add(key);

      return STATE[colIndex][rowIndex].computedValue || 0;
    });

    return eval(formulaWithValues);
  } catch (e) {
    return `!ERROR`;
  }
}

function updateDependentCells(x, y) {
  const key = `${x},${y}`;
  if (!dependents[key]) return;

  dependents[key].forEach((dep) => {
    const [depX, depY] = dep.split(",").map(Number);
    const cell = STATE[depX][depY];

    cell.computedValue = computeValue(cell.value, depX, depY);
    updateDependentCells(depX, depY);
  });

  renderSpreadSheet();
}

const renderSpreadSheet = () => {
  const headerHTML = `<tr>
            <th></th>
            ${range(COLUMNS)
              .map((i) => `<th>${getColumnLetter(i)}</th>`)
              .join("")}
        </tr>`;

  $thead.innerHTML = headerHTML;

  const bodyHTML = range(ROWS)
    .map((row) => {
      return `<tr>
            <td>${row + 1}</td>
            ${range(COLUMNS)
              .map(
                (column) => `
                <td data-x="${column}" data-y="${row}" >
                    <span>${STATE[column][row].computedValue}</span>
                    <input type="text" value="${STATE[column][row].value}" />
                </td>`
              )
              .join("")}
        </tr>`;
    })
    .join("");

  $tbody.innerHTML = bodyHTML;
};

$tbody.addEventListener("click", (event) => {
  const td = event.target.closest("td");
  if (!td) return;

  const { x, y } = td.dataset;
  const input = td.querySelector("input");

  const end = input.value.length;
  input.setSelectionRange(end, end);
  input.focus();

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") input.blur();
  });

  input.addEventListener(
    "blur",
    () => {
      console.log({ value: input.value, state: STATE[x][y].value });

      if (input.value === STATE[x][y].value) return;

      updateCell({ x, y, value: input.value });
    },
    { once: true }
  );
});
renderSpreadSheet();
