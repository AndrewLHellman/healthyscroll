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
    """
    Policy-independent description, cached per Reel and handed to Jev as a frame caption.

    Jev decides against policies we can't see ("women", "Minecraft", "gambling",
    "politics"...), and it only knows what this text says. So the description has
    to be concrete: Gemini writes "a person" and "a video game" unless told to
    commit (2026-09-27: a Reel of a woman talking to camera came back as "a
    person ... speaking", and a Minecraft Reel as "a video game").
    """
    return (
        f"These are {n_frames} frames from one short video, in order. In under 60 words, describe "
        "what the video shows, as concretely as possible:\n"
        "- people: how many, apparent gender and age group (e.g. \"a young woman\", \"two teenage boys\", "
        "\"an older man\"), what they wear and do;\n"
        "- the topic or genre (comedy skit, dance, cooking, sport, gaming, news, advert, ...);\n"
        "- name what you recognise: the game, show, sport, team, brand, product, celebrity, place;\n"
        "- activities, objects, setting, and on-screen text (quote it).\n"
        "Be direct, never hedge or say 'a person' when you can tell more. No filler about colours, layout or mood."
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
