import collections
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

import jsonpath_rw


pkg_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))  # noqa
sys.path.insert(0, pkg_root)  # noqa


from starfish.util import clock


def get_field_from(json_filepath, jsonpath_expr, nth=0):
    """
    Load up a JSON document from ``json_filepath`` and return the `nth` result matching the JSONPath expression
    ``jsonpath_expr``.
    """
    parser = jsonpath_rw.parse(jsonpath_expr)
    with open(json_filepath, "r") as fh:
        document = json.load(fh)
    return parser.find(document)[nth].value


def get_codebook(tempdir):
    filename = get_field_from(
        os.path.join(tempdir, "formatted", "experiment.json"),
        "$.[codebook]")
    return os.path.join(tempdir, "formatted", filename)


class TestWithIssData(unittest.TestCase):
    SUBDIRS = (
        "raw",
        "formatted",
        "registered",
        "filtered",
        "results",
    )

    STAGES = (
        [
            sys.executable,
            "examples/get_iss_data.py",
            lambda tempdir, *args, **kwargs: os.path.join(tempdir, "raw"),
            lambda tempdir, *args, **kwargs: os.path.join(tempdir, "formatted"),
            "--d", "1",
        ],
        [
            "starfish", "register",
            "--input", lambda tempdir, *args, **kwargs: os.path.join(tempdir, "formatted", "experiment.json"),
            "--output", lambda tempdir, *args, **kwargs: os.path.join(tempdir, "registered"),
            "fourier_shift",
            "--u", "1000",
        ],
        [
            "starfish", "filter",
            lambda tempdir, *args, **kwargs: os.path.join(tempdir, "registered", "experiment.json"),
            lambda tempdir, *args, **kwargs: os.path.join(tempdir, "filtered"),
            "--ds", "15",
        ],
        [
            "starfish", "detect_spots",
            lambda tempdir, *args, **kwargs: os.path.join(tempdir, "filtered", "experiment.json"),
            lambda tempdir, *args, **kwargs: os.path.join(tempdir, "results"),
            "dots",
            "--min_sigma", "4",
            "--max_sigma", "6",
            "--num_sigma", "20",
            "--t", "0.01",
        ],
        [
            "starfish", "segment",
            lambda tempdir, *args, **kwargs: os.path.join(tempdir, "filtered", "experiment.json"),
            lambda tempdir, *args, **kwargs: os.path.join(tempdir, "results"),
            "stain",
            "--dt", ".16",
            "--st", ".22",
            "--md", "57",
        ],
        [
            "starfish", "gene_assignment",
            "--coordinates-geojson",
            lambda tempdir, *args, **kwargs: os.path.join(tempdir, "results", "regions.geojson"),
            "--spots-json", lambda tempdir, *args, **kwargs: os.path.join(tempdir, "results", "spots.json"),
            "--output", lambda tempdir, *args, **kwargs: os.path.join(tempdir, "results", "regions.json"),
            "deep_assigner",
        ],
        [
            "starfish", "decode",
            "-i", lambda tempdir, *args, **kwargs: os.path.join(tempdir, "results", "encoder_table.json"),
            "--codebook", lambda tempdir, *args, **kwargs: get_codebook(tempdir),
            "-o", lambda tempdir, *args, **kwargs: os.path.join(tempdir, "results", "decoded_table.json"),
            "iss",
        ],
    )

    def test_run_pipeline(self):
        tempdir = tempfile.mkdtemp()
        coverage_enabled = "STARFISH_COVERAGE" in os.environ

        def callback(interval):
            print(" ".join(stage[:2]), " ==> {} seconds".format(interval))

        try:
            for subdir in TestWithIssData.SUBDIRS:
                os.makedirs("{tempdir}".format(
                    tempdir=os.path.join(tempdir, subdir)))
            for stage in TestWithIssData.STAGES:
                cmdline = [
                    element(tempdir=tempdir) if callable(element) else element
                    for element in stage
                ]
                if cmdline[0] == 'starfish' and coverage_enabled:
                    coverage_cmdline = [
                        "coverage", "run",
                        "-p",
                        "--source", "starfish",
                        "-m", "starfish",
                    ]
                    coverage_cmdline.extend(cmdline[1:])
                    cmdline = coverage_cmdline
                with clock.timeit(callback):
                    subprocess.check_call(cmdline)
            with open(os.path.join(tempdir, "results", "decoded_table.json")) as fh:
                results = json.load(fh)

            counts = collections.defaultdict(lambda: 0)
            for record in results:
                counts[record['barcode']] += 1
            tuples = [(count, barcode) for barcode, count in counts.items()]
            tuples.sort(reverse=True)
            self.assertEqual("AAGC", tuples[0][1])
            self.assertEqual("AGGC", tuples[1][1])
        finally:
            shutil.rmtree(tempdir)
