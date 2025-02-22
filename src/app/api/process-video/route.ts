import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { writeFile } from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Create a temporary directory for processing
    const tempDir = path.join(process.cwd(), 'temp')
    await createDirIfNotExists(tempDir)

    // Save the uploaded file
    const inputPath = path.join(tempDir, 'input.mp4')
    const bytes = await file.arrayBuffer()
    await writeFile(inputPath, Buffer.from(bytes))

    // Process the video using the Python script
    const outputPath = await processVideo(inputPath)

    // Return the processed video
    const processedVideo = await readFile(outputPath)
    
    // Clean up temporary files
    await cleanup(inputPath, outputPath)

    return new NextResponse(processedVideo, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'attachment; filename="processed.mp4"'
      }
    })
  } catch (error) {
    console.error('Video processing failed:', error)
    return NextResponse.json(
      { error: 'Video processing failed' },
      { status: 500 }
    )
  }
}

async function createDirIfNotExists(dir: string) {
  const fs = require('fs/promises')
  try {
    await fs.access(dir)
  } catch {
    await fs.mkdir(dir, { recursive: true })
  }
}

async function processVideo(inputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python', [
      'src/process/cut_video.py',
      '--input', inputPath
    ])

    let outputPath = ''

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString()
      if (output.includes('Edited video saved to:')) {
        outputPath = output.split('Edited video saved to:')[1].trim()
      }
    })

    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python error: ${data}`)
    })

    pythonProcess.on('close', (code) => {
      if (code === 0 && outputPath) {
        resolve(outputPath)
      } else {
        reject(new Error(`Python process exited with code ${code}`))
      }
    })
  })
}

async function readFile(path: string): Promise<Buffer> {
  const fs = require('fs/promises')
  return fs.readFile(path)
}

async function cleanup(...paths: string[]) {
  const fs = require('fs/promises')
  for (const path of paths) {
    try {
      await fs.unlink(path)
    } catch (error) {
      console.warn(`Failed to delete ${path}:`, error)
    }
  }
} 