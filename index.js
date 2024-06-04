import Epub from './epub-parser.js'
import { text, intro, outro, select } from '@clack/prompts'

async function displayChapter(epub, chapterPath) {
  const content = await epub.getChapterContent(chapterPath)
  console.log(content)
}

async function selectNavPoint(navPoints) {
  const options = navPoints?.map((navPoint, index) => ({
    value: index.toString(),
    label: navPoint.title,
  }))

  const selection = await select({
    message: 'Select a chapter or topic:',
    options: [...options, { value: 'back', label: 'Go Back' }],
  })

  if (selection === 'back') {
    return null
  }

  const selectedNavPoint = navPoints[parseInt(selection, 10)]
  if (selectedNavPoint.subNavPoints.length > 0) {
    const subSelection = await selectNavPoint(selectedNavPoint.subNavPoints)
    if (subSelection) {
      return subSelection
    }
  }

  return selectedNavPoint.src
}

async function main() {
  intro('Welcome to the EPUB Reader CLI')

  const filePath = await text({
    message: 'Enter the path to the EPUB file:',
    placeholder: 'Path to EPUB file',
    validate(value) {
      if (value.length === 0) return 'File path is required!'
    },
  })

  const epub = new Epub(filePath)

  try {
    const { chapters, title, author, toc } = await epub.parseEpub()
    console.log(`Title: ${title}`)
    console.log(`Author: ${author}`)

    while (true) {
      const chapterPath = await selectNavPoint(toc)

      if (!chapterPath) {
        break
      }

      await displayChapter(epub, chapterPath)
    }
  } catch (error) {
    console.error(`Error: ${error.message}`)
  }

  outro('Thank you for using the EPUB Reader CLI')
}

main()
