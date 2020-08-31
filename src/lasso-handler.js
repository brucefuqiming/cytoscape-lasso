import pointInPolygon from 'point-in-polygon';

function isMultSelKeyDown(e) {
  return e.shiftKey || e.metaKey || e.ctrlKey;
};

export class LassoHandler {
  cy;
  canvas;
  ctx;
  polygon;

  originalBoxSelectionEnabled;
  originalUserPanningEnabled;

  onGraphMouseDownBound = this.onGraphMouseDown.bind(this);
  onGraphMouseMoveBound = this.onGraphMouseMove.bind(this);
  onGraphMouseUpBound = this.onGraphMouseUp.bind(this);

  constructor(cy) {
    this.cy = cy;

    const originalCanvas = this.cy.container().firstChild.firstChild;
    if (originalCanvas.tagName.toLowerCase() !== 'canvas') {
      throw new Error('Invalid state');
    }

    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('data-id', 'layer0-lasso');
    this.canvas.width = originalCanvas.width;
    this.canvas.height = originalCanvas.height;
    this.canvas.setAttribute('style', originalCanvas.getAttribute('style'));
    originalCanvas.parentElement.insertBefore(this.canvas, originalCanvas);
    this.ctx = this.canvas.getContext('2d');

    this.cy.on('mousedown', this.onGraphMouseDownBound);
    this.cy.on('mousemove', this.onGraphMouseMoveBound);
    this.cy.on('mouseup', this.onGraphMouseUpBound);
  }

  destroy() {
    this.cy.off('mousedown', this.onGraphMouseDownBound);
    this.cy.off('mousemove', this.onGraphMouseMoveBound);
    this.cy.off('mouseup', this.onGraphMouseUpBound);

    this.cy = undefined;
    this.canvas.remove();
    this.canvas = undefined;
    this.ctx = undefined;
  }

  onGraphMouseDown(event) {
    if (!isMultSelKeyDown(event.originalEvent)) {
      return;
    }

    this.disableOriginalBehavior();

    this.polygon = [[event.originalEvent.clientX, event.originalEvent.clientY]];
    this.render();

    event.preventDefault();
  }

  onGraphMouseMove(event) {
    if (!this.polygon) {
      return;
    }

    this.polygon.push([event.originalEvent.clientX, event.originalEvent.clientY]);
    this.render();
    
    event.preventDefault();
  }

  onGraphMouseUp(event) {
    if (!this.polygon) {
      return;
    }

    this.finish();

    this.polygon = undefined;
    this.render();

    this.enableOriginalBehavior();

    event.preventDefault();
  }

  /* private */ disableOriginalBehavior() {
    this.originalBoxSelectionEnabled = this.cy.boxSelectionEnabled();
    this.originalUserPanningEnabled = this.cy.userPanningEnabled();

    this.cy.boxSelectionEnabled(false);
    this.cy.userPanningEnabled(false);

    this.cy._private.renderer.hoverData.selecting = true;
  }

  /* private */ enableOriginalBehavior() {
    this.cy.boxSelectionEnabled(this.originalBoxSelectionEnabled);
    this.cy.userPanningEnabled(this.originalUserPanningEnabled);

    this.originalBoxSelectionEnabled = undefined;
    this.originalUserPanningEnabled = undefined;

    this.cy._private.renderer.hoverData.selecting = false;
  }

  /* private */ render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (!this.polygon) {
      return;
    }

    const style = this.cy.style();
    const color = style.core('selection-box-color').value;
    const borderColor = style.core('selection-box-border-color').value;
    const borderWidth = style.core('selection-box-border-width').value;
    const opacity = style.core('selection-box-opacity').value;

    // begin scaled drawing
    const pixelRatio = this.canvas.width / this.canvas.clientWidth;
    this.ctx.scale(pixelRatio, pixelRatio);

    // draw path
    this.ctx.beginPath();
    this.ctx.moveTo(this.polygon[0][0], this.polygon[0][1]);
    for (let position of this.polygon) {
      this.ctx.lineTo(position[0], position[1]);
    }

    // stroke
    if (borderWidth > 0) {
      this.ctx.lineWidth = borderWidth;
      this.ctx.strokeStyle = `rgba(${borderColor[0]}, ${borderColor[1]}, ${borderColor[2]}, ${opacity})`;
      this.ctx.stroke();
    }

    // fill
    this.ctx.closePath();
    this.ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${opacity})`;
    this.ctx.fill();

    // end scaled drawing
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /* private */ finish() {
    if (!this.polygon) {
      return;
    }

    const nodes = this.cy.nodes();

    if (this.cy.selectionType() === 'single') {
      nodes.unselect();
    }

    const selectedNodes = nodes.filter(node => {
      const renderedPosition = node.renderedPosition();
      const point = [renderedPosition.x, renderedPosition.y];
      return pointInPolygon(point, this.polygon);
    });
    
    selectedNodes.select();
  }
}