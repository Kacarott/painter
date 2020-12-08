'use babel';


// Convert event to svg space
export function toSVG(event, refSVG) {
  while (refSVG.tagName != 'svg') refSVG = refSVG.parentElement;
  let p = refSVG.createSVGPoint();
  p.x = event.x;
  p.y = event.y;
  let newP = p.matrixTransform(refSVG.getScreenCTM().inverse());
  if (event.width && event.height) {
    let dims = toSVG({
      x: event.x + event.width,
      y: event.y + event.height}, refSVG);
    newP.width = dims.x - newP.x;
    newP.height = dims.y - newP.y;
  }
  return newP;
}

// Add attributes to svg elements
export function setAtts(element, values) {
  for (const val of Object.keys(values)) {
    element.setAttribute(val, values[val]);
  }
}

// Make svg element
export function make(tag, ...classes) {
  let elem = document.createElementNS("http://www.w3.org/2000/svg",tag);
  classes.forEach(c => elem.classList.add(c));
  return elem;
}

// Seperate check for element identifiers.
function matchesElem(identifier, element) {
  let checks = identifier.split(/([.#[])/).filter(Boolean);
  while (checks.length) {

    // Class
    if (checks[0] === ".") {
      if (!element || !((element.hasAttribute("class")
        && element.getAttribute("class").split(" ").includes(checks[1])))) {
        return false;
      }
      checks.shift();

    // ID
    } else if (checks[0] === "#") {
      if (!(element.getAttribute("id") === checks[1])) return false;
      checks.shift();

    // Attribute
    } else if (checks[0] === "[") {
      let attList = checks[1].slice(0,-1).split(/([~|^$*]?)=/).filter(Boolean);
      let val = element.getAttribute(attList[0]);
      let atlen = attList.length;

      // Case-insensitive
      if (attList[atlen-1].slice(-2) === " i") {
        attList[atlen-1] = attList[atlen-1].toLowerCase().slice(0,-2);
        val = val.toLowerCase();
      }
      // Lots of attribute options to check
      if ((atlen == 1 && !val)
        || (atlen == 2 && val !== attList[1])
        || (atlen == 3 && (
        (attList[1] === "~" && !val.split(/\s+/).includes(attList[2]))
          || (attList[1] === "|" && !(attList[2] === val
            || val.indexOf(attList[2] + "-") == 0))
          || (attList[1] === "^" && val.indexOf(attList[2]) != 0)
          || (attList[1] === "$" && val.slice(-attList[2].length) !== attList[2])
          || (attList[1] === "*" && !val.includes(attList[2]))
        ))) {
        return false;
      }

      // Move to next check
      checks.shift();
    } else if (element.tagName.toLowerCase() !== checks[0].toLowerCase()) {
      return false;
    }
    checks.shift();
  }
  // All checks complete
  return true;
}

// Check if css identifier applies to element
export const css = {
  "match": (rule, elem) => {
    var res = [];
    if (rule[0] === '@') return false; // Probably don't need to deal with these
    var sel, combs, elemPointers;

    // Get a list of conditions
    let selectors = rule.slice(0, rule.indexOf("{")).trim().split(/\s*,\s*/);
    for (let i = 0; i < selectors.length; i++) {
      elemPointers = [elem];
      sel = selectors[i];
      combs = sel.split(/\s*([\s>~+])\s*/).reverse().filter(Boolean);
      while (combs.length) {
        if (combs[0] === "*") {
          combs.shift();
          continue;
        }

        // Ancestor conditions
        if ([' ', '~'].includes(combs[0])) {
          let relation = (combs[0] === ' ')
            ? "parentElement" : "previousElementSibling";
          elemPointers = elemPointers.map(v => {
            let newElems = [];
            let par = v;
            while ((par = par[relation])) {
              if (matchesElem(combs[1], par)) newElems.push(par);
            }
            return newElems;
          }).flat();

        // Sibling conditions
        } else if (['>', '+'].includes(combs[0])) {
          let relation = (combs[0] === ' ')
            ? "parentElement" : "previousElementSibling";
          elemPointers = elemPointers.map(v => v[relation]).filter(v => {
            return (v && matchesElem(combs[1], v));
          });
        } else {
          elemPointers = elemPointers.filter(v => matchesElem(combs[0], v));
          combs.shift();
          continue;
        }
        combs.splice(0, 2);
      }
      if (elemPointers.length) {
        res.push(sel);
      }
    }
    return res;
  },

  // This probably doesn't need to be here
  "format": (rule, oldCol, newCol) => rule
    .replace(new RegExp(oldCol.replace(/[()]/g, '\\$&'), 'g'), newCol)
}
