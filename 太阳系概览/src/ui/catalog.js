import { CATALOG_GROUPS, BODY_MAP } from '../data/bodies.js'

const pad2 = (n) => String(n).padStart(2, '0')

// 左侧目录
export function renderCatalog(container, onSelect) {
  container.innerHTML = ''
  for (const group of CATALOG_GROUPS) {
    const wrap = document.createElement('section')
    wrap.className = 'cat-group'

    const head = document.createElement('h3')
    head.innerHTML = `${group.title}<em>${group.en}</em>`
    wrap.appendChild(head)

    const list = document.createElement('ul')
    for (const id of group.ids) {
      const data = BODY_MAP.get(id)
      const item = document.createElement('li')
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'cat-item'
      btn.dataset.id = id
      btn.setAttribute('aria-pressed', 'false')
      btn.innerHTML = `<span class="cat-num">${pad2(data.index)}</span><span class="cat-cn">${data.name}</span><span class="cat-en">${data.en}</span>`
      btn.addEventListener('click', () => onSelect(id, 'catalog'))
      item.appendChild(btn)
      list.appendChild(item)
    }
    wrap.appendChild(list)
    container.appendChild(wrap)
  }
}

// 3D 场景上的文字标签
export function buildLabels(layer, onSelect) {
  const labels = new Map()
  for (const data of BODY_MAP.values()) {
    if (data.id === 'moon') continue // 月球标签在总览里容易与地球重叠，靠近时再显示
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'body-label'
    el.dataset.id = data.id
    el.innerHTML = `<span class="label-dot"></span><span class="label-cn">${data.name}</span>`
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      onSelect(data.id, 'label')
    })
    layer.appendChild(el)
    labels.set(data.id, el)
  }
  return labels
}

export function updateLabels(labels, camera, world, selectedId, visible) {
  const width = camera.userData.width || window.innerWidth
  const height = camera.userData.height || window.innerHeight
  for (const [id, el] of labels) {
    if (!visible) {
      el.classList.add('is-hidden')
      continue
    }
    const pos = world.getWorldPosition(id)
    const projected = pos.clone().project(camera)
    const inView = projected.z < 1 && projected.z > -1 && Math.abs(projected.x) < 1.05 && Math.abs(projected.y) < 1.05
    if (!inView) {
      el.classList.add('is-hidden')
      continue
    }
    const x = (projected.x * 0.5 + 0.5) * width
    const y = (-projected.y * 0.5 + 0.5) * height
    el.classList.remove('is-hidden')
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${(y - 16).toFixed(1)}px, 0) translate(-50%, -100%)`
    el.classList.toggle('is-active', id === selectedId)
  }
}

// 右侧信息面板
export function renderPanel(root, data) {
  root.querySelector('#panel-type').textContent = data.typeLabel
  root.querySelector('#panel-name').textContent = data.name
  root.querySelector('#panel-en').textContent = data.en.toUpperCase()
  root.querySelector('#panel-intro').textContent = data.intro

  const stats = root.querySelector('#panel-stats')
  stats.innerHTML = ''
  for (const [label, value] of data.stats) {
    const item = document.createElement('div')
    item.className = 'stat'
    item.innerHTML = `<span>${label}</span><b>${value}</b>`
    stats.appendChild(item)
  }

  const focus = root.querySelector('#panel-focus')
  focus.innerHTML = ''
  for (const text of data.focus) {
    const li = document.createElement('li')
    li.textContent = text
    focus.appendChild(li)
  }

  const sources = root.querySelector('#panel-sources')
  sources.innerHTML = ''
  for (const s of data.sources) {
    const li = document.createElement('li')
    const a = document.createElement('a')
    a.href = s.url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.textContent = s.label
    li.appendChild(a)
    sources.appendChild(li)
  }
}
