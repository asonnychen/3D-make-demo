// 把 dist 构建结果内联成一个可双击打开的单文件 HTML
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const out = resolve(root, process.argv[2] || 'kolner-dom.html')

let html = readFileSync(resolve(dist, 'index.html'), 'utf8')

html = html.replace(
  /<script[^>]*\ssrc="([^"]+)"[^>]*>\s*<\/script>/g,
  (_, src) => {
    const js = readFileSync(resolve(dist, '.' + src), 'utf8').replace(/<\/script/gi, '<\\/script')
    return `<script type="module">\n${js}\n</script>`
  },
)

html = html.replace(
  /<link[^>]*\srel="stylesheet"[^>]*\shref="([^"]+)"[^>]*>/g,
  (_, href) => {
    const css = readFileSync(resolve(dist, '.' + href), 'utf8')
    return `<style>\n${css}\n</style>`
  },
)

if (/\ssrc="\/assets\//.test(html) || /href="\/assets\//.test(html)) {
  throw new Error('还有未内联的资源引用')
}

writeFileSync(out, html)
console.log(`wrote ${out} (${(statSync(out).size / 1024).toFixed(0)} KB)`)
