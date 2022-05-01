&nbsp;
## Usage
### Install Node.js

Download a pre-built installer for your platform from https://nodejs.org/en/download/.

### Download the repo

```
git clone https://github.com/ero1311/SegGroup.annotator
```

```
cd annotator/
```

### Download the ScanNet dataset

Our annotation tool uses .PLY scans from ScanNet. Please follow the [instructions](https://github.com/ScanNet/ScanNet#scannet-data) to download.

### Prepare files
Add a soft link to the downloaded ScanNet dataset (use absolute path).

```
ln -s DATASET_ABSOLUTE_PATH public/data/scannet
```

Create a folder anywhere outside this repo to save annotated labels. Add a soft link to the label folder (use absolute path).

```
ln -s LABEL_ABSOLUTE_PATH public/data/label
```

### Start the application
Start the Web interface.

```
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

&nbsp;
## Reference repos:  
- [SegGroup.annotator](https://github.com/AnTao97/SegGroup.annotator)  
