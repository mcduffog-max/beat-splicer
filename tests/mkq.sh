#!/bin/bash
# qlib: 12 sharp clips + 12 soft (blurred) copies; plib: 12 panning right + 12 panning left (mandelbrot/life textures)
enc(){ ffmpeg -y -loglevel error "$@" -c:v libvpx-vp9 -b:v 900k -g 48 -row-mt 1 -deadline realtime -cpu-used 8 -an; }
for k in $(seq 0 11); do h=$((k*30)); n=$(printf "%02d" $k)
  enc -f lavfi -i "testsrc2=size=640x360:rate=24:d=10" -vf "hue=h=$h" qlib/sharp$n.mp4
  enc -f lavfi -i "testsrc2=size=640x360:rate=24:d=10" -vf "hue=h=$h,boxblur=8:2" qlib/soft$n.mp4
  enc -f lavfi -i "mandelbrot=size=1600x360:rate=24:start_scale=$((2+k%4)):end_scale=$((2+k%4)),hue=h=$h" -t 10 -vf "crop=640:360:'t*90':0" plib/right$n.mp4
  enc -f lavfi -i "mandelbrot=size=1600x360:rate=24:start_scale=$((2+k%4)):end_scale=$((2+k%4)),hue=h=$h" -t 10 -vf "crop=640:360:'900-t*90':0" plib/left$n.mp4
done
