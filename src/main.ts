import './style.css'
import { TypsterityGame } from './game'
import { createAppMarkup } from './ui'
import { inject } from "@vercel/analytics"

inject()
const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('Could not find the app root.')
}

app.innerHTML = createAppMarkup()

const game = new TypsterityGame(app)

void game.initialize()
