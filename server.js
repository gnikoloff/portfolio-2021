const path = require('path')
const express = require('express')

const PORT = process.env.PORT || 8080

const app = express()

app.use(express.static('dist'))

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => console.info(`App is running on port ${PORT}`))
