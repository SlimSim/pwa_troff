# Troff

Troff - training with music, a music player for dancers or musicians
who needs to practice dance-steps or instruments to music.

# setup:

`npm install`

`npm run copy`

## run the app localy:

`npm run dev`

## Icons

Note: Make sure your SVG files have fill="currentColor" in them if you want to control color via CSS! (do this with text-editor)

You can edit icons in InkScape, But make sure that both the page and viewBox is set to 24\*24!

1. Go to File → Document Properties (or Ctrl+Shift+D)
2. In the Page tab, note your document dimensions
3. Check "Scale x" - this shows you the viewBox values
4. Before saving, go to File → Save As...
5. Choose "Optimized SVG" as the file type
6. In the options dialog that appears:
7. Under "SVG Output" tab:
8. Check "Remove the XML declaration" (optional)
9. Check "Enable viewboxing"
10. Click OK

## Read me tip:

`ctrl + shift + v` shows a preview of hte README!

## Web Components and Lit:

Using web components and lit to create custom elements!

## test build

This is a **composite** script that runs: linting, type checking, and building sequentially
(ie 'npm run lint', 'npm run typecheck', 'npm run build')

`npm run build:check`

So that is your _one stop shop_ for checking if your code is ready for production!

# Analytics

Going with Firebase Analytics, but do not send data to Firebase Analytics if user has not consented to cookie use.
