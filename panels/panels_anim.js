// (c) copyright 2019 Balázs Galambosi (support@homenewtab.com)

// https://developers.google.com/web/updates/2017/03/performant-expand-and-collapse

function createKeyframeAnimation () {
  // Figure out the size of the element when collapsed.
  let {x, y} = calculateCollapsedScale();
  let animation = '';
  let inverseAnimation = '';

  for (let step = 0; step <= 100; step++) {
    // Remap the step value to an eased one.
    let easedStep = ease(step / 100);

    // Calculate the scale of the element.
    const xScale = x + (1 - x) * easedStep;
    const yScale = y + (1 - y) * easedStep;

    animation += `${step}% {
      transform: scale(${xScale}, ${yScale});
    }`;

    // And now the inverse for the contents.
    const invXScale = 1 / xScale;
    const invYScale = 1 / yScale;
    inverseAnimation += `${step}% {
      transform: scale(${invXScale}, ${invYScale});
    }`;

  }

  return `
  @keyframes menuAnimation {
    ${animation}
  }

  @keyframes menuContentsAnimation {
    ${inverseAnimation}
  }`;
}

// https://github.com/tweenjs/tween.js/blob/master/src/Tween.js
function ease (v, pow=4) {
  return 1 - Math.pow(1 - v, pow);
}

/*
css

.menu--expanded {
  animation-name: menuAnimation;
  animation-duration: 0.2s;
  animation-timing-function: linear;
}

.menu__contents--expanded {
  animation-name: menuContentsAnimation;
  animation-duration: 0.2s;
  animation-timing-function: linear;
}

*/