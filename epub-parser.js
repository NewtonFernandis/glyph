import fs from 'fs'
import JSZip from 'jszip'
import xml2js from 'xml2js'
import path from 'path'
import { convert } from 'html-to-text'
import * as cheerio from 'cheerio'

export default class Epub {
  zip
  constructor(filePath) {
    if (!filePath) {
      throw new Error('Missing filePath argument')
    }
    this.filePath = filePath
  }

  async parseEpub() {
    const data = fs.readFileSync(this.filePath)
    this.zip = await JSZip.loadAsync(data)

    const container = await this.zip
      .file('META-INF/container.xml')
      ?.async('string')
    if (!container) {
      throw new Error('Missing container.xml file')
    }

    const containerJson = await xml2js.parseStringPromise(container)
    const rootFile =
      containerJson.container.rootfiles[0].rootfile[0]['$']['full-path']

    const content = await this.zip.file(rootFile)?.async('string')
    if (!content) {
      throw new Error(`Missing root file: ${rootFile}`)
    }

    const contentJson = await xml2js.parseStringPromise(content)

    const manifest = contentJson.package.manifest[0].item
    const spine = contentJson.package.spine[0].itemref

    const items = {}
    manifest.forEach((item) => {
      items[item['$'].id] = item['$'].href
    })

    const chapters = spine.map((itemref) => items[itemref['$'].idref])

    // Extract additional metadata (optional)
    const metadata = contentJson.package.metadata[0]

    const title = metadata['dc:title'][0]
    const author = metadata['dc:creator'][0]._
    console
    const tocPath = items['ncx'] || 'toc.ncx'

    const tocContent = await this.zip.file('OEBPS/' + tocPath)?.async('string')
    const tocJson = await xml2js.parseStringPromise(tocContent)

    const navMap = tocJson.ncx.navMap[0].navPoint
    const toc = this.parseNavPoints(navMap)

    const zip = this.zip
    return { zip, chapters, title, author, toc }
  }

  parseNavPoints(navPoints) {
    return navPoints.map((navPoint) => ({
      title: navPoint.navLabel[0].text[0],
      src: navPoint.content[0]['$'].src,
      subNavPoints: navPoint.navPoint
        ? this.parseNavPoints(navPoint.navPoint)
        : [],
    }))
  }

  async getChapterContent(chapterPath) {
    const [filePath, id] = chapterPath.split('#')
    const content = await this.zip.file('OEBPS/' + filePath)?.async('string')
    if (!content) {
      throw new Error(`Missing chapter file: ${'OEBPS/' + filePath}`)
    }

    if (id) {
      const $ = cheerio.load(content)
      const element = $(`#${id}`)
      if (element.length) {
        return this.convertHtml(element.html())
      } else {
        throw new Error(`Missing element with ID: ${id}`)
      }
    }

    const convertedContent = this.convertHtml(content)
    return convertedContent
  }

  convertHtml(content) {
    return convert(content, {
      selectors: [
        { selector: 'img', format: 'skip' },
        { selector: 'a', options: { ignoreHref: true } },
      ],
    })
  }
}
