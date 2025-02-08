const $ = (el) => document.querySelector(el);
const $$ = (el) => document.querySelectorAll(el);

const $table = $("table");
const $thead = $("thead");
const $tbody = $("tbody");

const ROWS = 30;
const COLUMNS = 26;
const FIRST_CHAR_CODE = 65;

const range = (length) => Array.from({ length }, (_, i) => i);
const getColumnLetter = (i) => String.fromCharCode(i + FIRST_CHAR_CODE);

const safeFunctions = {
  SUM: (...args) => args.reduce((acc, val) => acc + (Number(val) || 0), 0),
  AVG: (...args) => (args.length ? safeFunctions.SUM(...args) / args.length : 0),
  MIN: (...args) => Math.min(...args.map(Number)),
  MAX: (...args) => Math.max(...args.map(Number)),
  ABS: (value) => Math.abs(Number(value)),
  ROUND: (value, digits = 0) => Number(value).toFixed(digits),
  IF: (condition, trueVal, falseVal) => (condition ? trueVal : falseVal),
};

let dependencies = {};
let dependents = {};

let editingCell = null;

let STATE = range(COLUMNS).map((i) => range(ROWS).map((j) => ({ computedValue: "", value: "" })));

function updateCell({ x, y, value }) {
  STATE[x][y].value = value;

  STATE[x][y].computedValue = computeFormula(value, x, y);

  updateDependentCells(x, y);

  renderSpreadSheet();
}

function computeAllCells() {
  dependencies = {};
  dependents = {};

  STATE.forEach((col, x) => {
    col.forEach((cell, y) => {
      cell.computedValue = computeFormula(cell.value, x, y);
    });
  });
}

function computeFormula(formula, x, y) {
  if (!formula.startsWith("=")) return formula;

  const key = `${x},${y}`;

  if (dependencies[key]?.has(key)) {
    return "!CIRCULAR";
  }

  dependencies[key] = new Set();

  try {
    const formulaWithValues = formula
      .slice(1)
      .replace(/([A-Z]+)(\d+)/g, (match, colLetter, rowNum) => {
        const colIndex = colLetter.charCodeAt(0) - FIRST_CHAR_CODE;
        const rowIndex = parseInt(rowNum, 10) - 1;

        if (colIndex < 0 || colIndex >= COLUMNS || rowIndex < 0 || rowIndex >= ROWS) {
          throw new Error(`Invalid reference: ${match}`);
        }

        dependencies[key].add(`${colIndex},${rowIndex}`);

        const refKey = `${colIndex},${rowIndex}`;
        if (!dependents[refKey]) dependents[refKey] = new Set();
        dependents[refKey].add(key);

        return STATE[colIndex]?.[rowIndex]?.computedValue || 0;
      })
      .replace(/\bSUM\b/g, "safeFunctions.SUM")
      .replace(/\bAVG\b/g, "safeFunctions.AVG")
      .replace(/\bMAX\b/g, "safeFunctions.MAX")
      .replace(/\bMIN\b/g, "safeFunctions.MIN")
      .replace(/\bROUND\b/g, "safeFunctions.ROUND")
      .replace(/\bIF\b/g, "safeFunctions.IF");

    return new Function("safeFunctions", `return ${formulaWithValues}`)(safeFunctions);
  } catch (e) {
    return "!ERROR";
  }
}

function updateDependentCells(x, y) {
  const key = `${x},${y}`;
  if (!dependents[key]) return;

  dependents[key].forEach((dep) => {
    const [depX, depY] = dep.split(",").map(Number);
    const cell = STATE[depX][depY];

    cell.computedValue = computeFormula(cell.value, depX, depY);
    updateDependentCells(depX, depY);
  });
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
                    <input type="text" value="${STATE[column][row].value}" readonly />
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

  const input = td.querySelector("input");
  const { x, y } = td.dataset;

  if (editingCell && editingCell !== td) {
    const prevInput = editingCell.querySelector("input");
    const { x: prevX, y: prevY } = editingCell.dataset;

    if (prevInput && prevInput.value !== STATE[prevX][prevY].value) {
      updateCell({ x: prevX, y: prevY, value: prevInput.value });
      moveFocus(x, y);
    }

    prevInput.readOnly = true;
    prevInput.classList.remove("editing");
  }
  if (input !== document.activeElement) input.focus();
});

$tbody.addEventListener("dblclick", (event) => {
  const td = event.target.closest("td");
  if (!td) return;

  editingCell = td;

  const input = td.querySelector("input");

  if (input.readOnly) {
    input.readOnly = false;
    input.classList.add("editing");
    const end = input.value.length;
    input.setSelectionRange(end, end);
    input.scrollLeft = input.scrollWidth;
  }
});

$tbody.addEventListener("keydown", (event) => {
  const td = event.target.closest("td");
  if (!td) return;

  const input = td.querySelector("input");
  const { x, y } = td.dataset;

  let nextX = parseInt(x);
  let nextY = parseInt(y);

  const isPrintableKey = event.key.length === 1 && !event.ctrlKey && !event.metaKey;

  if (isPrintableKey && input.readOnly) {
    event.preventDefault();
    editingCell = td;
    input.readOnly = false;
    input.classList.add("editing");

    input.value = event.key;
    input.setSelectionRange(1, 1);
  }

  switch (event.key) {
    case "Enter":
      input.readOnly = true;
      input.classList.remove("editing");

      if (input.value !== STATE[x][y].value) {
        updateCell({ x, y, value: input.value });
      }

      nextY += 1;
      moveFocus(nextX, nextY);
      break;
    case "ArrowDown":
      nextY += 1;
      break;
    case "ArrowUp":
      nextY -= 1;
      break;
    case "ArrowRight":
      nextX += 1;
      break;
    case "ArrowLeft":
      nextX -= 1;
      break;
    default:
      return;
  }

  if (input.readOnly) {
    moveFocus(nextX, nextY);
  }
});

function moveFocus(x, y) {
  const nextTd = document.querySelector(`td[data-x="${x}"][data-y="${y}"]`);
  const nextInput = nextTd?.querySelector("input");

  if (nextInput && nextInput.readOnly) {
    nextInput.focus();
    const end = nextInput.value.length;
    nextInput.setSelectionRange(end, end);
  }
}

renderSpreadSheet();
