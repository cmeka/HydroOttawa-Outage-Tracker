Used crontab to run the scraper "scrape.sh" every 5 min like so:\
`*/5 * * * * screen -dmS scrape_outages /home/ubuntu/scrape.sh`

Then extracted all the files into a folder "outages".

Install dependencies and run index.js with Node.js:\
`npm install`
then
`node .`

Convert images to video using ffmpeg:\
`ffmpeg -f concat -r 20 -i list.txt -s 1920x1080 -c:v libx264 -vf "fps=20,format=yuv420p" timelapse.mp4`
