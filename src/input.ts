// DEADGRID input — keyboard/mouse with pointer lock, edge-pressed keys,
// and raw button state. Game reads via isDown()/consumePressed().

import type { PlayerInput } from './player';

export class InputManager {
  keys = new Map<string, boolean>();
  private pressedThisFrame = new Set<string>();
  private pressedQueue = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  wheelDelta = 0;
  locked = false;
  private target: HTMLElement | null = null;

  attach(target: HTMLElement): void {
    if (this.target) return;
    this.target = target;
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    target.addEventListener('mousemove', this.onMouseMove);
    target.addEventListener('mousedown', this.onMouseDown);
    target.addEventListener('mouseup', this.onMouseUp);
    target.addEventListener('wheel', this.onWheel, { passive: true });
    target.addEventListener('contextmenu', this.onCtx);
    document.addEventListener('pointerlockchange', this.onLockChange);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    if (this.target) {
      this.target.removeEventListener('mousemove', this.onMouseMove);
      this.target.removeEventListener('mousedown', this.onMouseDown);
      this.target.removeEventListener('mouseup', this.onMouseUp);
      this.target.removeEventListener('wheel', this.onWheel);
      this.target.removeEventListener('contextmenu', this.onCtx);
    }
    this.target = null;
  }

  private onKey = (e: KeyboardEvent): void => {
    const k = e.code;
    if (e.type === 'keydown') {
      if (!this.keys.get(k)) this.pressedQueue.add(k);
      this.keys.set(k, true);
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(k)) e.preventDefault();
    } else {
      this.keys.delete(k);
    }
  };
  private onMouseMove = (e: MouseEvent): void => {
    if (!this.locked) return;
    this.mouseDX += e.movementX;
    this.mouseDY += e.movementY;
  };
  private onMouseDown = (e: MouseEvent): void => {
    if (!this.locked) return;
    const k = e.button === 0 ? 'Mouse0' : e.button === 2 ? 'Mouse2' : null;
    if (k) {
      if (!this.keys.get(k)) this.pressedQueue.add(k);
      this.keys.set(k, true);
    }
  };
  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.keys.delete('Mouse0');
    if (e.button === 2) this.keys.delete('Mouse2');
  };
  private onWheel = (e: WheelEvent): void => {
    this.wheelDelta = Math.max(-1, Math.min(1, this.wheelDelta + Math.sign(e.deltaY)));
  };
  private onCtx = (e: Event): void => e.preventDefault();

  private onLockChange = (): void => {
    this.locked = document.pointerLockElement != null;
    if (!this.locked) {
      this.keys.clear();
      this.pressedQueue.clear();
    }
  };

  isDown(code: string): boolean { return this.keys.get(code) === true; }

  /** True once per key-down; clears the queue each frame via endFrame. */
  consumePressed(code: string): boolean {
    if (this.pressedThisFrame.has(code)) {
      this.pressedThisFrame.delete(code);
      return true;
    }
    return false;
  }

  consumeMouseDelta(): [number, number] {
    const dx = this.mouseDX, dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return [dx, dy];
  }

  consumeWheel(): number {
    const v = this.wheelDelta;
    this.wheelDelta = 0;
    return v;
  }

  /** Rolls the pressed-queue into the current frame. Call at update start. */
  beginFrame(): void {
    this.pressedThisFrame = new Set(this.pressedQueue);
    this.pressedQueue.clear();
  }

  /** Standard movement input for the player. */
  playerInput(): PlayerInput {
    return {
      fwd: this.isDown('KeyW') || this.isDown('ArrowUp'),
      back: this.isDown('KeyS') || this.isDown('ArrowDown'),
      left: inputStateHelper(this, 'KeyA', 'ArrowLeft'),
      right: inputStateHelper(this, 'KeyD', 'ArrowRight'),
      jump: this.isDown('Space'),
      sprint: this.isDown('ShiftLeft') || this.isDown('ShiftRight'),
      crouch: this.isDown('KeyC') || this.isDown('ControlLeft'),
    };
  }
}

function inputStateHelper(input: InputManager, a: string, b: string): boolean {
  return input.isDown(a) || input.isDown(b);
}