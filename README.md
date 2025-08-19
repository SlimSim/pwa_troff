# Troff
Troff - training with music, a music player for dancers or musicians
who needs to practice dance-steps or instruments to music.

## Install & Run Tests

1. Install dependencies (if you haven't already):
   ```sh
   npm install
   ```
2. Install Jest (if not already installed):
   ```sh
   npm install --save-dev vitest jsdom
   ```
3. (Optional) Add this to your `package.json` scripts section for easier running:
   ```json
   "scripts": {
     "test": "vitest run"
   }
   ```
4. **Run tests:**
   ```sh
   npm test
   ```

Your tests are located in the `tests/` folder. Example tests are provided in `tests/basic.test.js`.


##things to install:
'''
npm install -D @vitest/coverage-v8@1.6.1
'''

uppdatera coverage:
npx vitest run --coverage