import net from 'node:net'

const port = 8787
const server = net.createServer()

server.once('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `API port ${port} is already in use. Stop the existing API process before running pnpm dev.`,
    )
  } else {
    console.error(`Could not check whether API port ${port} is available.`, error)
  }
  process.exitCode = 1
})

server.listen(port, '127.0.0.1', () => {
  server.close((error) => {
    if (error) {
      console.error(`Could not release API port ${port} after checking it.`, error)
      process.exitCode = 1
    }
  })
})
