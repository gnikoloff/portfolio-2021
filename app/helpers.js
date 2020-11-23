export const loadImage = ({ src }) => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error(`Failed loading image with src ${src}`))
  image.src = src
})