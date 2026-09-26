"""The one question every VLM scorer is asked, so benchmark results are comparable."""


def yes_no_prompt(policy: str, n_frames: int) -> str:
    # "Is it about / does it feature a topic" rather than "does it contain that kind
    # of content": on a real chihuahua Reel (policy "cats, dogs, animals") Qwen3-VL-2B
    # went 0.47 -> 0.84 while non-matching Reels stayed <= 0.06 (2026-09-26). Same
    # finding as the Jev question in packages/shared/src/questions.ts.
    return (
        f"These are {n_frames} frames from one short video, in order. "
        "The viewer does not want to see videos about these topics:\n"
        f'"{policy.strip()}"\n'
        "Is this video about, or does it feature, any of those topics? Answer with a single word: Yes or No."
    )


def describe_prompt(n_frames: int) -> str:
    """Policy-independent description, cached per Reel and handed to Jev as a frame caption."""
    return (
        f"These are {n_frames} frames from one short video, in order. In under 40 words, say what "
        "the video is about: people, activities, objects, setting, and any on-screen text (quote it). "
        "No filler about colours, layout or mood."
    )


def percent_prompt(policy: str, n_frames: int) -> str:
    """For hosted models where we can't read token probabilities."""
    return (
        f"These are {n_frames} frames from one short video, in order. "
        "The viewer asked to skip videos containing the following:\n"
        f'"{policy.strip()}"\n'
        "How likely is it that this video contains that kind of content? "
        "Reply with only an integer from 0 to 100."
    )
