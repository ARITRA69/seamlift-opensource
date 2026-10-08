# Modal recipe

Builds the local seamtranscode source into a Node 22 image with ffmpeg, then plans a job, runs one container per rendition, makes previews in parallel, and writes the master playlist. All containers read and write the same S3/R2 bucket. No package needs to be published first.

1. Install and authenticate [Modal](https://modal.com/docs/guide).
2. Create a Modal secret named `seamtranscode-storage` with `SEAMTRANSCODE_STORAGE=r2`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, and `SEAMTRANSCODE_PUBLIC_URL`. For S3 use `SEAMTRANSCODE_STORAGE=s3`, `S3_BUCKET`, `S3_REGION`, and AWS credentials instead.
3. Upload a video to your bucket and run from the repository root:

```sh
modal run recipes/modal/app.py --key uploads/film.mp4 --output videos/film
# To expose the function for your backend:
modal deploy recipes/modal/app.py
```

Your backend can call `modal.Function.from_name("seamtranscode", "transcode")` with `key` and `output`. Use a unique output prefix per job. The result is the same JSON as the library's `transcode()`.

Each worker downloads the source independently; for large files you can adapt `sourceCache` to a shared Modal Volume. The example caps encoding at ten containers and one hour per function. Adjust those values for your traffic and media lengths. These calls run billable compute only when you execute them; this recipe is not deployed by repository checks.

See Modal's [image guide](https://modal.com/docs/guide/images) and [parallel execution guide](https://modal.com/docs/guide/scale).
