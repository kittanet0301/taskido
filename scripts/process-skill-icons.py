#!/usr/bin/env python3
"""Extract generated 3x3 skill sheets into validated 128px Taskino icons."""
from __future__ import annotations
import json
from collections import deque
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ICON_ROOT = ROOT / "assets" / "battle" / "skill-icons"
RAW_ROOT, PROMPT_ROOT = ICON_ROOT / "raw", ICON_ROOT / "prompts"
CANVAS, INNER = 128, 112
SKILLS = {
 "fire": ["spark_bite","flame_rush","magma_pierce","inferno_burst","heat_guard","smoke_step","kindling","cinder_mark","solar_eruption"],
 "grass": ["leaf_slash","vine_lash","thorn_pierce","bloom_burst","bark_shield","pollen_dodge","photosynth","seed_mark","overgrowth"],
 "ground": ["pebble_shot","quake_stomp","drill_fang","boulder_crash","stone_wall","sand_veil","tectonic_pulse","fault_line","terra_break"],
 "electric": ["static_nibble","volt_dash","needle_bolt","thunder_clap","shock_armor","afterimage","charge_up","spark_field","storm_crown"],
 "water": ["bubble_jab","surge_rush","jet_pierce","tidal_burst","foam_guard","mist_step","undertow","ripple_mark","abyss_roar"],
 "ice": ["frost_nip","glacier_rush","icicle_pierce","blizzard_burst","crystal_guard","snow_fade","deep_freeze","rime_mark","absolute_zero"],
 "dragon": ["scale_bite","wyrm_rush","horn_pierce","roar_burst","scale_mail","wing_slip","blood_surge","omen_mark","elder_wrath"],
 "dark": ["shadow_bite","night_rush","umbra_pierce","void_burst","cloak_guard","fade_step","hex_chant","curse_mark","eclipse_fang"],
 "neutral": ["plain_strike","power_rush","focus_pierce","impact_burst","guard_stance","sidestep","rally","brand_mark","finishing_blow"],
}
ROLES = ["basic","heavy","pierce","burst","guard","dodge","support","mark","ultimate"]

def write_qa_contact_sheet() -> None:
    cell = 176
    atlas = Image.new("RGB", (cell * 9, cell * 9), (24, 16, 18))
    draw = ImageDraw.Draw(atlas)
    try:
        font = ImageFont.truetype("arial.ttf", 13)
    except OSError:
        font = ImageFont.load_default()
    for row, (element, slugs) in enumerate(SKILLS.items()):
        for col, slug in enumerate(slugs):
            path_id = f"{element}_{slug}"
            x, y = col * cell, row * cell
            tile = Image.new("RGBA", (128, 128), (48, 36, 40, 255))
            tile.alpha_composite(Image.open(ICON_ROOT / f"{path_id}.png").convert("RGBA"))
            atlas.paste(tile.convert("RGB"), (x + 24, y + 8))
            draw.rectangle((x, y, x + cell - 1, y + cell - 1), outline=(116, 82, 57), width=2)
            draw.text((x + 5, y + 140), path_id, fill=(255, 232, 190), font=font)
    atlas.save(RAW_ROOT / "skill-icons-qa-contact-sheet.png", optimize=True)

def key_cell(cell: Image.Image) -> Image.Image:
    rgba = np.asarray(cell.convert("RGBA"), dtype=np.float32).copy()
    rgb = rgba[:, :, :3]
    key = np.median(np.array([rgb[0,0],rgb[0,-1],rgb[-1,0],rgb[-1,-1]]), axis=0)
    distance = np.linalg.norm(rgb-key, axis=2)
    alpha = np.clip((distance-18.0)/(105.0-18.0), 0.0, 1.0)
    spill = np.maximum(0.0, rgb[:,:,0]-np.maximum(rgb[:,:,1],rgb[:,:,2]))
    rgb[:,:,0] = np.maximum(0.0, rgb[:,:,0]-spill*(1.0-alpha)*0.9)
    rgba[:,:,:3], rgba[:,:,3] = rgb, alpha*255.0
    return remove_edge_debris(Image.fromarray(np.clip(rgba,0,255).astype(np.uint8), "RGBA"))

def remove_edge_debris(image: Image.Image) -> Image.Image:
    """Drop tiny disconnected fragments and cross-cell spill without touching the main icon."""
    rgba = np.asarray(image, dtype=np.uint8).copy()
    mask = rgba[:, :, 3] > 24
    height, width = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    components: list[tuple[list[tuple[int, int]], tuple[int, int, int, int]]] = []
    for y in range(height):
        for x in range(width):
            if not mask[y, x] or seen[y, x]:
                continue
            queue = deque([(x, y)]); seen[y, x] = True; pixels = []
            min_x = max_x = x; min_y = max_y = y
            while queue:
                px, py = queue.popleft(); pixels.append((px, py))
                min_x=min(min_x,px); max_x=max(max_x,px); min_y=min(min_y,py); max_y=max(max_y,py)
                for nx, ny in ((px-1,py),(px+1,py),(px,py-1),(px,py+1)):
                    if 0 <= nx < width and 0 <= ny < height and mask[ny,nx] and not seen[ny,nx]:
                        seen[ny,nx] = True; queue.append((nx,ny))
            components.append((pixels,(min_x,min_y,max_x+1,max_y+1)))
    if not components:
        return image
    main_area = max(len(pixels) for pixels, _ in components)
    edge_margin = max(8, round(min(width, height) * 0.025))
    min_area = max(48, round(main_area * 0.008))
    for pixels, bbox in components:
        area = len(pixels)
        touches_guard = bbox[0] <= edge_margin or bbox[1] <= edge_margin or bbox[2] >= width-edge_margin or bbox[3] >= height-edge_margin
        if area < min_area or (touches_guard and area < main_area * 0.20):
            for x, y in pixels:
                rgba[y, x, 3] = 0
    return Image.fromarray(rgba, "RGBA")

def normalize(cell: Image.Image) -> tuple[Image.Image,list[int]]:
    keyed = key_cell(cell)
    alpha = np.asarray(keyed.getchannel("A")); ys,xs = np.where(alpha>12)
    if len(xs)==0: raise ValueError("empty icon cell")
    bbox=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]
    subject=keyed.crop(tuple(bbox)); scale=min(INNER/subject.width,INNER/subject.height)
    size=(max(1,round(subject.width*scale)),max(1,round(subject.height*scale)))
    subject=subject.resize(size,Image.Resampling.LANCZOS)
    out=Image.new("RGBA",(CANVAS,CANVAS),(0,0,0,0))
    out.alpha_composite(subject,((CANVAS-size[0])//2,(CANVAS-size[1])//2))
    return out,bbox

def main() -> None:
    entries=[]
    for element,slugs in SKILLS.items():
        source,prompt=RAW_ROOT/f"{element}-sheet.png",PROMPT_ROOT/f"{element}.prompt.txt"
        if not source.exists() or not prompt.exists(): raise FileNotFoundError(f"missing source or prompt for {element}")
        sheet=Image.open(source).convert("RGBA")
        if sheet.width%3 or sheet.height%3: raise ValueError(f"{source.name} must divide evenly into 3x3")
        cw,ch=sheet.width//3,sheet.height//3
        for index,(slug,role) in enumerate(zip(slugs,ROLES)):
            row,col=divmod(index,3); path_id=f"{element}_{slug}"
            icon,bbox=normalize(sheet.crop((col*cw,row*ch,(col+1)*cw,(row+1)*ch)))
            icon.save(ICON_ROOT/f"{path_id}.png",optimize=True)
            if icon.getpixel((0,0))[3]!=0 or icon.getbbox() is None: raise ValueError(f"alpha QC failed: {path_id}")
            entries.append({"pathId":path_id,"element":element,"role":role,"kind":"ultimate" if role=="ultimate" else "skill","file":f"{path_id}.png","sourceSheet":f"raw/{element}-sheet.png","prompt":f"prompts/{element}.prompt.txt","cell":{"row":row,"column":col},"sourceBounds":bbox,"width":CANVAS,"height":CANVAS})
    manifest={"schema":"taskino.skill-icons.v1","count":len(entries),"icons":entries}
    (ICON_ROOT/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
    write_qa_contact_sheet()
    print(f"Wrote {len(entries)} skill icons")

if __name__ == "__main__": main()
