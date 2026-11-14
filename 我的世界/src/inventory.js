/* ============================================================
   背包：36 格（前 9 格是快捷栏）+ 物品堆叠 + 合成 + 界面渲染
   ============================================================ */

import { ITEMS, RECIPES, describeItem } from './items.js'

export const INV_SIZE = 36
export const HOTBAR_SIZE = 9

const maxStackOf = (id) => ITEMS.get(id)?.stack ?? 64

/** 新建一个物品堆 */
export function makeStack(id, count = 1, durability) {
  const item = ITEMS.get(id)
  if (!item) return null
  const stack = { id, count }
  if (item.durability != null) {
    stack.durability = durability ?? item.durability
  }
  return stack
}

/* ------------------------------------------------------------ 数据模型 */

export class Inventory {
  constructor() {
    this.slots = new Array(INV_SIZE).fill(null)
    this.listeners = new Set()
    this._depth = 0
  }

  onChange(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  emit() {
    if (this._depth > 0) return
    for (const fn of this.listeners) fn(this)
  }

  /** 批量修改，只触发一次刷新 */
  batch(fn) {
    this._depth++
    try {
      fn()
    } finally {
      this._depth--
      if (this._depth === 0) this.emit()
    }
  }

  get(index) {
    return this.slots[index] || null
  }

  set(index, stack) {
    this.slots[index] = stack && stack.count > 0 ? stack : null
    this.emit()
  }

  clear() {
    this.batch(() => this.slots.fill(null))
  }

  /** 往背包里放东西，返回没放下的数量 */
  add(id, count = 1) {
    const item = ITEMS.get(id)
    if (!item) return count
    let left = count
    this.batch(() => {
      if (item.stack > 1) {
        for (let i = 0; i < INV_SIZE && left > 0; i++) {
          const slot = this.slots[i]
          if (!slot || slot.id !== id) continue
          const room = item.stack - slot.count
          if (room <= 0) continue
          const put = Math.min(room, left)
          slot.count += put
          left -= put
        }
      }
      for (let i = 0; i < INV_SIZE && left > 0; i++) {
        if (this.slots[i]) continue
        const put = Math.min(item.stack, left)
        this.slots[i] = makeStack(id, put)
        left -= put
      }
    })
    return left
  }

  /** 背包里某物品的总数 */
  countOf(id) {
    let n = 0
    for (const slot of this.slots) {
      if (slot && slot.id === id) n += slot.count
    }
    return n
  }

  has(needs) {
    return needs.every((need) => this.countOf(need.id) >= need.count)
  }

  /** 扣除若干材料，数量不足则不做任何修改 */
  consume(id, count) {
    if (this.countOf(id) < count) return false
    let left = count
    this.batch(() => {
      for (let i = 0; i < INV_SIZE && left > 0; i++) {
        const slot = this.slots[i]
        if (!slot || slot.id !== id) continue
        const take = Math.min(slot.count, left)
        slot.count -= take
        left -= take
        if (slot.count <= 0) this.slots[i] = null
      }
    })
    return true
  }

  /** 扣掉某一格里的若干个 */
  consumeSlot(index, count = 1) {
    const slot = this.slots[index]
    if (!slot || slot.count < count) return false
    slot.count -= count
    if (slot.count <= 0) this.slots[index] = null
    this.emit()
    return true
  }

  findSlotOf(id) {
    return this.slots.findIndex((slot) => slot && slot.id === id)
  }

  /** 第一个空格，没有返回 -1 */
  firstEmpty(start = 0, end = INV_SIZE) {
    for (let i = start; i < end; i++) if (!this.slots[i]) return i
    return -1
  }

  canFit(id, count = 1) {
    const item = ITEMS.get(id)
    if (!item) return false
    if (item.stack > 1) {
      for (const slot of this.slots) {
        if (slot && slot.id === id && slot.count < item.stack) return true
      }
    }
    return this.firstEmpty() >= 0 || count <= 0
  }
}

/* ------------------------------------------------------------ 界面 */

export class InventoryUI {
  /**
   * @param {object} opts
   * @param {Inventory} opts.inventory
   * @param {object} opts.icons  图标工厂
   * @param {object} opts.el     界面元素
   * @param {(index:number)=>void} [opts.onSelect] 快捷栏选中变化
   */
  constructor({ inventory, icons, el, onSelect }) {
    this.inv = inventory
    this.icons = icons
    this.el = el
    this.onSelect = onSelect
    this.activeSlot = 0
    this.held = null
    this.open = false
    this.message = ''
    this.messageTimer = 0

    this.hotbarEl = el.hotbar
    this.screenEl = el.inventory
    this.storageEl = el.invStorage
    this.hotbarGridEl = el.invHotbar
    this.recipeEl = el.recipeList
    this.hintEl = el.invHint
    this.dragEl = el.invDrag
    this.craftHintEl = el.craftHint

    this.bind()

    inventory.onChange(() => {
      this.renderHotbar()
      if (this.open) this.renderPanel()
    })

    this.renderHotbar()
    this.renderRecipes()
  }

  /* ---------------------------------------------------------- 事件 */

  bind() {
    const slotHandler = (event) => {
      const target = event.target.closest('.slot')
      if (!target) return
      event.preventDefault()
      event.stopPropagation()
      const index = Number(target.dataset.index)
      if (Number.isNaN(index)) return
      this.clickSlot(index, event.button, event.shiftKey)
    }

    this.hotbarEl.addEventListener('mousedown', (event) => {
      const target = event.target.closest('.slot')
      if (!target) return
      event.stopPropagation()
      this.select(Number(target.dataset.index))
    })

    this.storageEl.addEventListener('mousedown', slotHandler)
    this.hotbarGridEl.addEventListener('mousedown', slotHandler)
    this.storageEl.addEventListener('contextmenu', (e) => e.preventDefault())
    this.hotbarGridEl.addEventListener('contextmenu', (e) => e.preventDefault())

    this.recipeEl.addEventListener('click', (event) => {
      const btn = event.target.closest('.recipe')
      if (!btn) return
      this.craft(Number(btn.dataset.recipe))
    })

    this.screenEl.addEventListener('mousemove', (event) => {
      if (!this.held) return
      this.moveDrag(event.clientX, event.clientY)
    })
  }

  /* ---------------------------------------------------------- 快捷栏 */

  select(index) {
    if (index < 0 || index >= HOTBAR_SIZE) return
    this.activeSlot = index
    this.hotbarEl.querySelectorAll('.slot').forEach((el, i) => {
      el.classList.toggle('active', i === index)
    })
    this.onSelect?.(index)
  }

  get activeItem() {
    return this.inv.get(this.activeSlot)
  }

  renderHotbar() {
    let html = ''
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      html += this.slotHTML(i, this.inv.get(i), i + 1, i === this.activeSlot)
    }
    this.hotbarEl.innerHTML = html
  }

  /* ---------------------------------------------------------- 面板 */

  openPanel() {
    if (this.open) return
    this.open = true
    this.screenEl.classList.remove('hidden')
    this.renderPanel()
  }

  closePanel() {
    if (!this.open) return
    this.open = false
    this.screenEl.classList.add('hidden')
    // 手里的东西放回背包，避免凭空消失
    if (this.held) {
      const left = this.inv.add(this.held.id, this.held.count)
      if (left > 0) this.say(`背包已满，${ITEMS.get(this.held.id)?.cn ?? ''} 掉在了地上`)
      this.held = null
      this.updateDrag()
    }
  }

  toggle() {
    if (this.open) this.closePanel()
    else this.openPanel()
  }

  renderPanel() {
    let storage = ''
    for (let i = HOTBAR_SIZE; i < INV_SIZE; i++) {
      storage += this.slotHTML(i, this.inv.get(i), 0, false)
    }
    this.storageEl.innerHTML = storage

    let hot = ''
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      hot += this.slotHTML(i, this.inv.get(i), i + 1, i === this.activeSlot)
    }
    this.hotbarGridEl.innerHTML = hot

    this.renderRecipes()
    this.updateDrag()
  }

  slotHTML(index, stack, num, active) {
    const classes = ['slot']
    if (active) classes.push('active')
    if (this.held && !stack) classes.push('drop-target')

    let img = ''
    let count = ''
    let dura = ''
    let title = '空'

    if (stack) {
      const item = ITEMS.get(stack.id)
      img = `<img alt="" src="${this.icons.itemURL(stack.id)}" />`
      if (stack.count > 1) count = `<span class="count">${stack.count}</span>`
      if (item?.durability != null && stack.durability != null) {
        const ratio = Math.max(0, Math.min(1, stack.durability / item.durability))
        const color = ratio > 0.5 ? '#7ec850' : ratio > 0.2 ? '#e0c04a' : '#c9583f'
        dura = `<span class="dura"><i style="width:${(ratio * 100).toFixed(1)}%;background:${color}"></i></span>`
      }
      title = item ? `${item.cn} · ${describeItem(stack.id)}` : stack.id
      if (item?.durability != null && stack.durability != null) {
        title += ` · 耐久 ${stack.durability}/${item.durability}`
      }
    }

    const numHTML = num ? `<span class="num">${num}</span>` : ''
    return `<button type="button" class="${classes.join(' ')}" data-index="${index}" title="${title}">${numHTML}${img}${count}${dura}</button>`
  }

  /* ---------------------------------------------------------- 拖动物品 */

  moveDrag(x, y) {
    this.dragEl.style.transform = `translate(${x + 10}px, ${y + 10}px)`
  }

  updateDrag() {
    if (!this.held) {
      this.dragEl.classList.add('hidden')
      this.dragEl.innerHTML = ''
      return
    }
    this.dragEl.classList.remove('hidden')
    const item = ITEMS.get(this.held.id)
    const count = this.held.count > 1 ? `<span class="count">${this.held.count}</span>` : ''
    this.dragEl.innerHTML = `<img alt="" src="${this.icons.itemURL(this.held.id)}" />${count}`
    this.dragEl.title = item?.cn ?? ''
  }

  /* ---------------------------------------------------------- 点击格子 */

  clickSlot(index, button, shift) {
    const inv = this.inv

    // Shift + 左键：快捷栏 ⇄ 背包 快速移动
    if (shift && button === 0 && !this.held) {
      this.quickMove(index)
      return
    }

    const slot = inv.get(index)

    if (button === 2) {
      // 右键：拿一半 / 放一个
      if (!this.held) {
        if (!slot) return
        const half = Math.ceil(slot.count / 2)
        this.held = { ...slot, count: half }
        slot.count -= half
        if (slot.count <= 0) inv.slots[index] = null
        inv.emit()
      } else if (!slot) {
        inv.batch(() => {
          inv.slots[index] = { ...this.held, count: 1 }
          this.held.count--
          if (this.held.count <= 0) this.held = null
        })
      } else if (slot.id === this.held.id) {
        const item = ITEMS.get(slot.id)
        if (slot.count < (item?.stack ?? 64)) {
          inv.batch(() => {
            slot.count++
            this.held.count--
            if (this.held.count <= 0) this.held = null
          })
        }
      }
      this.renderPanel()
      return
    }

    // 左键：拿起 / 放下 / 交换 / 合并
    if (!this.held) {
      if (!slot) return
      this.held = { ...slot }
      inv.slots[index] = null
      inv.emit()
    } else if (!slot) {
      inv.batch(() => {
        inv.slots[index] = this.held
        this.held = null
      })
    } else if (slot.id === this.held.id) {
      const item = ITEMS.get(slot.id)
      const room = (item?.stack ?? 64) - slot.count
      if (room > 0) {
        const put = Math.min(room, this.held.count)
        inv.batch(() => {
          slot.count += put
          this.held.count -= put
          if (this.held.count <= 0) this.held = null
        })
      } else {
        // 满了就交换
        inv.batch(() => {
          const tmp = this.held
          this.held = { ...slot }
          inv.slots[index] = tmp
        })
      }
    } else {
      inv.batch(() => {
        const tmp = this.held
        this.held = { ...slot }
        inv.slots[index] = tmp
      })
    }
    this.renderPanel()
  }

  quickMove(index) {
    const inv = this.inv
    const stack = inv.get(index)
    if (!stack) return
    const item = ITEMS.get(stack.id)
    const limit = item?.stack ?? 64
    const inHotbar = index < HOTBAR_SIZE
    const start = inHotbar ? HOTBAR_SIZE : 0
    const end = inHotbar ? INV_SIZE : HOTBAR_SIZE

    inv.batch(() => {
      // 先并入同类堆
      if (limit > 1) {
        for (let i = start; i < end && stack.count > 0; i++) {
          const slot = inv.slots[i]
          if (!slot || slot.id !== stack.id) continue
          const room = limit - slot.count
          if (room <= 0) continue
          const put = Math.min(room, stack.count)
          slot.count += put
          stack.count -= put
        }
      }
      // 再找空格
      for (let i = start; i < end && stack.count > 0; i++) {
        if (inv.slots[i]) continue
        inv.slots[i] = { ...stack }
        stack.count = 0
      }
      if (stack.count <= 0) inv.slots[index] = null
    })
    this.renderPanel()
  }

  /* ---------------------------------------------------------- 合成 */

  renderRecipes() {
    const scroll = this.recipeEl.scrollTop
    let html = ''
    RECIPES.forEach((recipe, index) => {
      const item = ITEMS.get(recipe.out)
      const count = recipe.count || 1
      const ok = this.inv.has(recipe.need)
      const needs = recipe.need
        .map((need) => {
          const needItem = ITEMS.get(need.id)
          const enough = this.inv.countOf(need.id) >= need.count
          return `<span class="need${enough ? '' : ' lack'}"><img alt="" src="${this.icons.itemURL(need.id)}" /><b>${need.count}</b>${needItem?.cn ?? ''}</span>`
        })
        .join('')
      html += `<button type="button" class="recipe${ok ? '' : ' disabled'}" data-recipe="${index}" ${ok ? '' : 'disabled'}>
        <span class="out"><img alt="" src="${this.icons.itemURL(recipe.out)}" /><b>${item?.cn ?? recipe.out}${count > 1 ? ` ×${count}` : ''}</b></span>
        <span class="needs">${needs}</span>
      </button>`
    })
    this.recipeEl.innerHTML = html
    this.recipeEl.scrollTop = scroll
  }

  craft(index) {
    const recipe = RECIPES[index]
    if (!recipe) return
    if (!this.inv.has(recipe.need)) {
      this.say('材料不足')
      return
    }
    const count = recipe.count || 1
    if (!this.inv.canFit(recipe.out, count)) {
      this.say('背包已满')
      return
    }
    this.inv.batch(() => {
      for (const need of recipe.need) this.inv.consume(need.id, need.count)
      this.inv.add(recipe.out, count)
    })
    const item = ITEMS.get(recipe.out)
    this.say(`合成 ${item?.cn ?? recipe.out} ×${count}`)
    this.renderPanel()
  }

  /* ---------------------------------------------------------- 提示 */

  say(text) {
    this.message = text
    this.messageTimer = 2.2
    if (this.craftHintEl) {
      this.craftHintEl.textContent = text
      this.craftHintEl.classList.add('show')
    }
  }

  tick(dt) {
    if (this.messageTimer > 0) {
      this.messageTimer -= dt
      if (this.messageTimer <= 0 && this.craftHintEl) {
        this.craftHintEl.classList.remove('show')
      }
    }
  }
}
