import './style.css'
import { TypsterityGame } from './game'
import { createAppMarkup } from './ui'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('Could not find the app root.')
}

app.innerHTML = createAppMarkup()

const game = new TypsterityGame(app)

void game.initialize()
