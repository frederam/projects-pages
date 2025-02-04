const $ = (el) => document.querySelector(el);
const $$ = (el) => document.querySelectorAll(el);

const $table = $("table");
const $thead = $("thead");
const $tbody = $("tbody");

const ROWS = 10;
const COLUMNS = 5;
const FIRST_CHAR_CODE = 65;

const range = (length) => Array.from({ length }, (_, i) => i);
const getColumnLetter = (i) => String.fromCharCode(i + FIRST_CHAR_CODE);

let STATE = range(COLUMNS).map((i) => range(ROWS).map((j) => ({ computedValue: 0, value: 0 })));

function updateCell({ x, y, value }) {
  const newState = structuredClone(STATE);
  const constants = generateCellsConstants(newState);

  const cell = newState[x][y];

  cell.computedValue = computeValue(value, constants); //span
  cell.value = value; //input

  newState[x][y] = cell;

  STATE = newState;

  renderSpreadSheet();
}

function generateCellsConstants(cells) {
  return cells
    .map((rows, x) => {
      return rows
        .map((cell, y) => {
          const letter = getColumnLetter(x);
          const cellId = `${letter}${y + 1}`;
          return `const ${cellId} = ${cell.computedValue};`;
        })
        .join("\n");
    })
    .join("\n");
}

function computeValue(value, constants) {
  if (!value.startsWith("=")) return value;

  const formula = value.slice(1);

  let computedValue;
  try {
    computedValue = eval(`(() => {
      ${constants}
      return ${formula};
    })()`);
  } catch (e) {
    computedValue = `!ERROR: ${e.message}`;
  }

  return computedValue;
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
  const span = td.querySelector("span");

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
