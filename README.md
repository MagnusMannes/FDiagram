# FDiagram
Tool for FD's

## Printing

Use the **Print PDF** button on the builder page to generate an A4 image.
The printout now renders at roughly 400 DPI and is printed from a hidden
iframe so no extra browser windows are opened.

## Scaling

On the builder page use the **Scale Up** and **Scale Down** buttons to adjust
the size of every component on the canvas. Each click changes the component
scale by 10%. Newly dropped components now use the current scale so they match
the rest of the assembly.

## Dragging

Click anywhere within a component's body to drag it around the canvas. Each
part's bounding box is now treated as a draggable area, so hollow regions are
also easily clickable.

## External drawings

When uploading PDF drawings as assemblies the pages are now rendered at a
higher resolution before being added to your BHA. This results in clearer
images when exporting or printing your assemblies.
