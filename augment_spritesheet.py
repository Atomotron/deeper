#!/usr/bin/env python3

import os,sys
import xml.etree.ElementTree as ET
import json

# Collect args
svgs = {} # filename -> full path
manifests = []
pad = 0
for a in sys.argv[1:]:
    try:
        pad = int(a)
        continue
    except TypeError:
        pass
    if a.endswith('.svg'):
        name = os.path.basename(a)
        if name in svgs:
            print(f"Warning: {name} is at {svgs[name]}, but another {name} was found at {a}. The original path will be kept and the new one ignored.")
        else:
            svgs[name] = a
    elif a.endswith('.json') and not a.endswith('.geom.json'):
        manifests.append(a)

print(f"Found {len(manifests)} sprite manifest(s) and {len(svgs)} SVG file(s).")

def circulate(elem):
    r = elem.get('r')
    if r is None:
        r = str((float(elem.get('rx',default=0)) + \
            + float(elem.get('ry',default=0))) \
            / 2.0)
    cx = elem.get('cx')
    cy = elem.get('cy')
    name = elem.get('data-name',default=elem.get('id'))
    return [name,{'r':r,'cx':cx,'cy':cy}]

def augment(frame,iname):
    tree = ET.parse(iname)
    root = tree.getroot()
    circles = {}
    for elem in tree.iter('{http://www.w3.org/2000/svg}circle'):
        name,circle = circulate(elem)
        circles[name] = circle
    for elem in tree.iter('{http://www.w3.org/2000/svg}ellipse'):
        name,circle = circulate(elem)
        circles[name] = circle
    frame['circles'] = circles

for iname in manifests:
    oname = iname[:-len('.json')] + '.geom.json'
    print(f'{iname} -> {oname}')
    with open(iname,'r') as src:
        data = json.loads(src.read())
    # Pad
    for frame in data['frames']:
        f = frame['frame']
        f['x'] -= pad
        f['y'] -= pad
        f['w'] += pad * 2
        f['h'] += pad * 2
    augmented_sprites = 0
    # Iterate over data
    frames = data['frames']
    for frame in frames:
        svg_name = os.path.splitext(os.path.basename(frame))[0] + '.svg'
        if svg_name in svgs:
            augment(frames[frame],svgs[svg_name])
            augmented_sprites += 1
    print(f'{iname}: Augmented {augmented_sprites} of {len(frames)} frames.')
    # Write augmented data
    with open(oname,'w') as dst:
        dst.write(json.dumps(data, sort_keys=True, indent=2))
