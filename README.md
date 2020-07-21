# Data Loader
A small programs that reads data specification and loads corresponding input files into postgres database (it should work with all databases supported by knex if you install the corresponding driver).

## Specification requirement
Data specification files should be a csv with three columns, "column name", "width" and "datatype".

Please see `specs/testformat.csv` for the sample specification.

Supported data types:
- TEXT
- BOOLEAN
- INTEGER

When a data file is loaded, a corresponding database table will be created according to the specification if the table does not exist.

## Data file requirement
The data file filename must have the same prefix as the specification filename and end with `_YYYY-MM-DD.txt`. For example, `testformat1_2015-06-28.txt` data file for `tsetformat1.csv` specification.

The data files are plain text files with no delimiter. Each line is parsed based on the width and data type specified in the specification.

A file is assumed to contain all the entries on a given date. i.e. if the program is run twice on `testformat1_2015-06-28.txt`, the records loaded in the 2nd run will overwrite the entries loaded in the 1st run.
This is achieved by deleting the previous entries with the same `_reportDate` field in the table.

By default, lines that do not match the specification will be skipped, and only valid entries are loaded. This behavior can be changed in the options of DataLoader.

## How to run?
You need Docker and Docker Compose installed to run the program.

Place your specification and data files into `specs` and `data` directory respectively.

Run the following script.
```bash
docker-compose build
docker-compose up
```

To run the test cases, run the following
```bash
docker-compose build
docker-compose -f docker-compose.yml -f docker-compose.test.yml up
```

## Limitation and Potential Improvement
- Data files are loaded every time the app is run
  - We can write a .processed file to indicate a file has been loaded
  - We can move the processed files to another directory
  - We can use a table to store the metadata of the processed files


- It may not be able to handle data files in GBs / TBs
  - If the streaming read implemented is not enough to handle huge data files, we can write records into a temporary table, then insert them into the actual table when finished. This will also allow the job to be resumable.


- No parallel jobs
  - Use a message queue to dispatch jobs to multiple instances of the app.
  Each instance can also spawn multiple worker threads to handle concurrent jobs.


- Only one data format is supported
  - Refactor data-loader.ts to support multiple formats such as csv
