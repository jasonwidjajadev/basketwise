Khushi  31 Aug - TODO


- [ ] Your fixes 
- [ ] Reproduciable scraper
        -> Check you can clone repo from scratch
        -> Have everything install and work
        -> FRESH VENV (5 minutes)
- [ ] Verify data
    -> verify_data.py (ai)
        1. connect to supabase
        2. how many unique days of data has been imported
        3. How many unique records are there?
            -> Check nothing is duplicated
            -> Have a few duplicate cehcks
- [ ] Break up the file structure
    
    Code Style ()
        -> DRY () - try not to have duplciated functions
        -> Breakl things up ijnto a few helper subfolders
        -> PYTHON TYPES!!!!!!!~
        

    Important Use TYPES.py:!!!





Frontend -> API REQUEST -> BACKEND (supabase)

Low Priority:

- [ ] CHECK THE SCRAPER IMPORTED ALL 50k items per store
        -> have an optional way to re-run the scraper (Missing duplicates)
        -> SAy the scraped failed at importing a specific object
        -> Return for specific items that wwere missed?  