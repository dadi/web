var dust = require("dustjs-linkedin")
var _ = require("underscore")

/*
* Paginate pages
* Usage:
* Send in current page, total pages, and a pattern for the path to generate.
* In the path pattern, use the  dust variable `n` where you want the page number inserted.
* ```
* {@paginate page=currentPageNumber totalPages=totalPageCount path="/page/{n}"}
*   <a href="{path}">{n}</a>
* {:current}
*   <a href="{path}">Current page {n}</a>
* {:prev}
*   <a href="{path}">Prev</a>
* {:next}
*   <a href="{path}">Next</a>
* {/paginate}
* ```
*/
dust.helpers.paginate = function(chunk, context, bodies, params) {
  var err

  if (!("page" in params && "totalPages" in params && "path" in params)) {
    err = new Error("Insufficient information provided to @paginate helper")
  }

  var current = parseInt(params.page, 10)
  var totalPages = parseInt(params.totalPages, 10)

  if (!(isFinite(current) && isFinite(totalPages))) {
    err = new Error("Parameters provided to @paginate helper are not integers")
  }

  var paginateContext = {
    n: current,
    path: ""
  }

  if (err) {
    console.log(err)
    return chunk
  }

  context = context.push(paginateContext)

  function printStep(body, n) {
    paginateContext.n = n
    paginateContext.path = context.resolve(params.path)

    if (n === 1) {
      // this is to make the path just the base path, without the number
      paginateContext.path = (paginateContext.path || "").replace(/1\/?$/, "")
    }

    chunk.render(body, context)
  }

  var printGap = bodies.gap ? printStep.bind(null, bodies.gap) : function() {}

  function printStepOrGap(step) {
    if (step === ".") {
      printGap()
    } else {
      printStep(bodies.block, step)
    }
  }

  function getStepSize(distance) {
    if (distance > 550) {
      return 500
    } else if (distance > 110) {
      return 100
    } else if (distance > 53) {
      return distance - 25
    } else if (distance > 23) {
      return distance - 10
    } else if (distance >= 10) {
      return distance - 5
    } else if (distance >= 5) {
      return distance - 2
    } else {
      return 1
    }
  }

  function makeSteps(start, end, tightness) {
    // start & end are non-inclusive
    var now
    var final
    var stepSize
    var steps = []

    if (tightness === "increase") {
      now = start
      final = end
      while (now < final) {
        if (now !== start) {
          steps.push(now)
        }

        stepSize = getStepSize(final - now)

        if (stepSize > 1) {
          steps.push(".")
        }

        now += stepSize
      }
    } else {
      // decrease
      now = end
      final = start

      while (now > final) {
        if (now !== end) {
          steps.push(now)
        }

        stepSize = getStepSize(now - final)

        if (stepSize > 1) {
          steps.push(".")
        }

        now -= stepSize
      }

      steps.reverse()
    }

    return steps
  }

  // Only one page
  if (!totalPages || totalPages === 1) {
    if (bodies.else) {
      return chunk.render(bodies.else, context)
    }
    return chunk
  }

  if (current > 1) {
    // Prev
    if (bodies.prev) {
      printStep(bodies.prev, current - 1)
    }
    // First step
    printStep(bodies.block, 1)
    // Pre current
    _.each(makeSteps(1, current, "increase"), printStepOrGap)
  }

  // Current
  printStep(bodies.current, current)

  if (current < totalPages) {
    // Post current
    _.each(makeSteps(current, totalPages, "decrease"), printStepOrGap)
    // Last step
    printStep(bodies.block, totalPages)
    // Next
    if (bodies.next) {
      printStep(bodies.next, current + 1)
    }
  }

  return chunk
}
