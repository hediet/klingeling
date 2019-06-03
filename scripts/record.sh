# create a ramdisk and record from webcam to MP4 DASH segments, keeping a history of 100 segments of 3 seconds each
# can't use the hardware encoder (h264_omx) because it doesn't support zerolatency :(
    
mkdir -p ramdisk
mountpoint ramdisk || sudo mount -t tmpfs none ramdisk
rm ramdisk/*
/usr/bin/ffmpeg -f v4l2 -framerate 10 -video_size 1280x720 \
    -i /dev/video0 \
    -filter:v "transpose=2,crop=413:710:207:531,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='%{localtime\:%X}':fontsize=60:fontcolor=white@0.8: x=7: y=7" \
    -c:v libx264 -preset ultrafast -tune zerolatency -flags +cgop -g $((3*10)) -pix_fmt yuv420p -b:v 400k \
    -seg_duration 3 -use_template 1 -use_timeline 0 -window_size 100 -streaming 1 -f dash \
    ramdisk/manifest-stream0.mpd