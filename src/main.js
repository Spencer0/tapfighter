import { start, G } from './engine.js';
import { buildSprites } from './sprites.js';
import { Title } from './title.js';

buildSprites();
start(new Title());
window.__TF = { G };
