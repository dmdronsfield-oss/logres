# Brentor for the browser: strip the scan's cut sides and base, decimate,
# add a vertex-coloured skirt falling away to the moor, 2k texture, Draco glb.
# Run: Blender -b -P tools/brentor_build.py -- <scan model.obj> <out.glb> <triangles>
import bpy, bmesh, sys, math, json
from mathutils import Vector
src, out, tris_target = sys.argv[-3], sys.argv[-2], int(sys.argv[-1])
SCALE = 2.5                       # scan units to metres (tower ~10 m)
ORIGIN = Vector((0.12, 1.87, 14.0))   # ground by the porch, in scan units
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=src)
o = bpy.context.scene.objects[0]; bpy.context.view_layer.objects.active = o; o.select_set(True)
bpy.ops.object.transform_apply(rotation=True)
me = o.data
bm = bmesh.new(); bm.from_mesh(me)
# Base rectangle: the bottom face's verts. Find its angle by min-area rect.
low = min(v.co.z for v in bm.verts)
base = [v.co.xy.copy() for v in bm.verts if v.co.z < low + 0.05]
best = None
for d in range(0, 90):
    a = math.radians(d); ux = Vector((math.cos(a), math.sin(a))); uy = Vector((-math.sin(a), math.cos(a)))
    xs = [p.dot(ux) for p in base]; ys = [p.dot(uy) for p in base]
    area = (max(xs) - min(xs)) * (max(ys) - min(ys))
    if not best or area < best[0]: best = (area, ux, uy, min(xs), max(xs), min(ys), max(ys))
_, ux, uy, x0, x1, y0, y1 = best
print("rect", round(x1-x0,2), round(y1-y0,2))
def edge_dist(p):
    x, y = p.dot(ux), p.dot(uy); return min(x - x0, x1 - x, y - y0, y1 - y)
kill = [f for f in bm.faces if f.normal.z < -0.9 or (abs(f.normal.z) < 0.6 and edge_dist(f.calc_center_median().xy) < 0.3)]
bmesh.ops.delete(bm, geom=kill, context='FACES')
# keep the largest connected piece
seen = set(); parts = []
for f in bm.faces:
    if f in seen: continue
    st = [f]; comp = []; seen.add(f)
    while st:
        g = st.pop(); comp.append(g)
        for e in g.edges:
            for h in e.link_faces:
                if h not in seen: seen.add(h); st.append(h)
    parts.append(comp)
parts.sort(key=len, reverse=True)
print("parts", [len(p) for p in parts[:5]])
bmesh.ops.delete(bm, geom=[f for p in parts[1:] for f in p], context='FACES')
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
for v in bm.verts: v.co = (v.co - ORIGIN) * SCALE
bm.to_mesh(me); bm.free()
# Decimate
m = o.modifiers.new('d', 'DECIMATE'); m.ratio = tris_target / len(me.polygons); m.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier='d')
print("tris", len(me.polygons))
# Skirt from the boundary loop, coloured from the texture at the edge.
img = next(i for i in bpy.data.images if 'diffuse' in i.name)
W, H = img.size; px = img.pixels[:]
def tex(uv):
    x = min(W-1, max(0, int(uv.x * W))); y = min(H-1, max(0, int(uv.y * H))); i = (y * W + x) * 4
    return Vector(px[i:i+3])
bm = bmesh.new(); bm.from_mesh(me); uvl = bm.loops.layers.uv.active
bm.verts.ensure_lookup_table()
def orig(co): return (co / SCALE + ORIGIN).xy
inner = [e for e in bm.edges if e.is_boundary and min(edge_dist(orig(v.co)) for v in e.verts) > 0.8]
print("inner hole edges", len(inner))
bmesh.ops.holes_fill(bm, edges=inner, sides=0)
for f in bm.faces:
    if f.material_index != 0: f.material_index = 0
bnd = [e for e in bm.edges if e.is_boundary]
print("still inner", sum(1 for e in bnd if min(edge_dist(orig(v.co)) for v in e.verts) > 0.8))
bv = list({v for e in bnd for v in e.verts})
nb = {v: [w for e in v.link_edges if e.is_boundary for w in e.verts if w is not v] for v in bv}
cen = sum((v.co for v in bv), Vector()) / len(bv)
col0 = {}
for v in bv:
    c = Vector((0, 0, 0)); n = 0
    for l in v.link_loops: c += tex(l[uvl].uv); n += 1
    col0[v] = c / max(n, 1)
for _ in range(8):
    col0 = {v: (col0[v] * 2 + sum((col0[w] for w in nb[v]), Vector())) / (2 + len(nb[v])) for v in bv}
moor = sum(col0.values(), Vector()) / len(bv)
print("boundary verts", len(bv), "moor", tuple(round(x, 3) for x in moor))
# outward directions, smoothed so neighbouring rays don't cross
dirs = {}
for v in bv:
    d = v.co.xy - cen.xy; dirs[v] = d.normalized() if d.length else Vector((1, 0))
for _ in range(20):
    dirs = {v: (dirs[v] + sum((dirs[w] for w in nb[v]), Vector((0, 0)))).normalized() for v in bv}
RINGS = [(10, -3), (40, -16), (220, -70)]
layers = [{v: v for v in bv}]
for dist, drop in RINGS:
    layers.append({v: bm.verts.new((v.co.x + dirs[v].x * dist, v.co.y + dirs[v].y * dist, v.co.z + drop)) for v in bv})
skirt_mat = len(me.materials)
sk = bpy.data.materials.new('skirt'); me.materials.append(sk)
col = bm.loops.layers.color.new('Col')
for f in bm.faces:
    for l in f.loops: l[col] = (1, 1, 1, 1)
T = len(layers) - 1
for e in bnd:
    lp = e.link_loops[0]          # the terrain face runs a -> b along this edge
    a, b = lp.vert, lp.link_loop_next.vert
    for li in range(T):
        A, B = layers[li], layers[li + 1]
        quad = [(b, li), (a, li), (a, li + 1), (b, li + 1)]
        try: f = bm.faces.new([(A if k == li else B)[v] for v, k in quad])
        except ValueError: continue
        f.material_index = skirt_mat; f.smooth = True
        for l, (v, k) in zip(f.loops, quad):
            t = k / T
            c = col0[v].lerp(moor, min(1, t * 1.5)) * (1 - 0.2 * t)
            l[col] = (c.x, c.y, c.z, 1); l[uvl].uv = (l.vert.co.x / 4, l.vert.co.y / 4)   # world-tiled, for the page's grass
bm.normal_update()
bm.to_mesh(me); bm.free()
# vertex colour material for the skirt
sk.use_nodes = True; nt = sk.node_tree
bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
nt.links.new(vc.outputs[0], bsdf.inputs['Base Color'])   # the page lays a tiled grass over it
bsdf.inputs['Roughness'].default_value = 1
tm = me.materials[0]; bsdf0 = next(n for n in tm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); bsdf0.inputs['Roughness'].default_value = 1
# 2k texture
img.scale(2048, 2048); img.filepath_raw = out.replace('.glb', '_tex.jpg'); img.file_format = 'JPEG'
bpy.context.scene.render.image_settings.quality = 82; img.save()
img.filepath = img.filepath_raw; img.reload()
# Path, in scan pixels of the zoomed top render (16 units / 1600 px about (-2.3, 4.9)), to metres in three.js (x, y up, z = -blender y)
P = [(110,165),(245,232),(470,350),(700,470),(745,495),(860,560),(960,612),(1060,660),(1150,705),(1192,752),(1165,815),(1120,885),(1075,960),(1040,1030),(1034,1065)]
pts = []
for (a, b) in P:
    w = (Vector((-2.3 + (a - 800) * 0.01, 4.9 - (b - 800) * 0.01, 0)) - Vector((ORIGIN.x, ORIGIN.y, 0))) * SCALE
    pts.append([round(w.x, 2), round(-w.y, 2)])
print("PATH", json.dumps(pts))
kw = dict(filepath=out, export_format='GLB', export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=7, export_draco_position_quantization=14, export_draco_texcoord_quantization=12,
    export_draco_color_quantization=8, export_image_format='JPEG', export_jpeg_quality=82)
props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
kw = {k: v for k, v in kw.items() if k in props}
if 'export_vertex_color' in props: kw['export_vertex_color'] = 'ACTIVE'
if 'export_colors' in props: kw['export_colors'] = True
bpy.ops.export_scene.gltf(**kw)
print("exported", out)
